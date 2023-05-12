export const handelsByPathname = {} 

const getDirectoryHandle = async (pathname) => await pathname.split('/').reduce(
    async (dir,dirName) => (dir = await dir.getDirectoryHandle(dirName,options)),
    await navigator.storage.getDirectory()
);

export const readdir = async (pathname,options={create: false, recursive: false}) => !options.create && options.recursive 
  ? readdirRecursiv(pathname) : [pathname, (await getDirectoryHandle(pathname)).values];

export const readdirRecursiv = async (pathname) => (await readdir(pathname,{create:false})).flatMap(
  handle => handle.kind === 'directory' 
    ? readdirRecursiv(`${pathname}/${handle.name}`)
    : handle
  )
);

const getDirPathnamesRecursiv = async (pathname) => (await readdir(pathname,{create:false}))
  .filter((handel) => handle.kind === 'directory')
  .map((dirHandle) => getDirPathnamesRecursiv(`${pathname}/${(await dirHandle).name}`));

// Can return a directoryHandleEntrie even if a filePath is given it returns the directoryHandle of the filePath
export const getDirectoryHandleEntrie = async (pathname = '.', options={create: false}) => 
  (pathname === '.' ||  pathname === '/' || pathname === './' ) ? await navigator.storage.getDirectory() : await pathname.split('/').reduce(
    async (dir,dirName) => (dir = await dir.getDirectoryHandle 
      ? [`${dir[0]}/${dirName}`, await dir[1].getDirectoryHandle(dirName, options)]
      : [dir[0], await dir[1]])],
    await navigator.storage.getDirectory()
  );

const resolvePathnameFromHandle = async (handle) => (await (await navigator.storage.getDirectory())
  .resolve(handle)).join('/') + `/${handle.name}`

export const getDirectoryEntries = (baseUrl = '.', maybeHandle) => new ReadableStream({ 
  async start(stream){
    const getDirectoryHandleEntrieRecursive = async (baseUrl = '.', maybeHandle) => {
      const [pathname, handle] = await maybeHandle 
        ? [`${baseUrl}/${(await maybeHandle).name}`,await maybeHandle] 
        : getDirectoryHandleEntrie(baseUrl,{create:false});
     
      // Storing handels by pathname for later lookups.
      handelsByPathname[pathname] = await handle;
     
      const { name, kind } = handle;
      const getEntrie = {
        async file() {
          const { size, type, lastModified } = await handle.getFile();
          const entrie = {
              pathname,  
              name, kind,
              size, type, lastModified,
          };

          stream.enqueue([pathname, entrie]);
          return [pathname,entrie];
        },
        async directory() {
          return [name,{
              pathname,
              name, kind,
              entries: Object.fromEntries(await Promise.all((await handle.values()).map(async (nextHandle)=>
                await getDirectoryHandleEntrieRecursive(`${pathname}/${(await nextHandle).name}`, await nextHandle)()
              ))),
          }];    
        }
      };
      
      return getEntrie[handle.kind]();
    }
    
    getEntriesRecursiv(baseUrl,maybeHandle);
  }
})


export const getRelativePath = async (handle) => `./${(await root.resolve(handle)).join('/')}`;    

// [directoryName,fileName];
const parsePath = (pathname) => [
  pathname.slice(0,pathname.lastIndexOf('/'),
  pathname.slice(pathname.lastIndexOf('/')+1
];


export const mkdirP = (pathname) => readdir(pathname,{create:true});
  
// Can returns exist fileHandel but can also create a fileHandle and path
export const getFileHandleFromPath = async (pathname,options={create:false}) => {
  const [directoryName,fileName] = parsePath(pathname);
  return await (await readdir(directoryName),options))
    .getFileHandle(fileName),options);
};

export const onrequest = async (request, sender, sendResponse) => {
  if (request.message?.startsWith('getDirectory')) {
    return getDirectoryEntriesRecursive(
      request.data || '.',
      getDirectoryHandle(request.data || '/'),
      sendResponse
    ).pipeTo(new WriteableStream({ write(entrie)}){ 
      sendResponse({ entrie });
    });
  } 
  
  if (request.message?.startsWith('save') === 'saveFile') {
    const fileHandle = handelsByPathname[request.data];
    try {
      return (await fileHandle.getFile()).stream()
        .pipeTo(await (await showSaveFilePicker({
            suggestedName: fileHandle.name
         })).createWritable());
    } catch ({name, message}) {
      name !== 'AbortError' &&
        console.error(name, message);
    }
  }
  
  if (request.message?.startsWith('delete')) {
    try {
      await handelsByPathname[request.data].remove();
      return sendResponse({ result: 'ok' });
    } catch ({name, message}) {
      console.error(name, message);
      sendResponse({ error: message });
    }
  }
};

export const browser = chrome || globalThis.browser;

browser.runtime.onMessage.addListener((request, sender, sendResponse) =>
  onrequest(request, sender, sendResponse) || true
);
