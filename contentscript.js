export const handelsByPathname = {} 

export const getRelativePath = async (handle) => `./${(await root.resolve(handle)).join('/')}`;    

export const getDirectoryEntriesRecursive = (baseUrl='.',handle,sendResponse) => {
  const pathname = `${baseUrl}/${handle.name}`;
  // Storing handels by pathname for later lookups.
  handelsByPathname[pathname] = handle;
  const { name, kind } = handle;
  const getEntrie = {
    async file() {
      const { size, type, lastModified } = await handle.getFile();
      
      const entrie = {
          pathname,  
          name, kind,
          size, type, lastModified,
      };
      
      sendResponse({ entrie });
      return entrie;
    },
    async directory() {
      return [name,{
          pathname,
          name, kind,
          entries: Object.fromEntries(await Promise.all((await handelsByPathname[pathname].values()).map((nextHandle)=>
            getDirectoryEntriesRecursive(`${pathname}/${nextHandle.name}`,nextHandle,sendResponse)()
          ))),
      }];    
    }
  };
  return getEntrie[handle.kind]();
};

// [directoryName,fileName];
const parsePath = (pathname) => [pathname.slice(0,pathname.lastIndexOf('/'),pathname.slice(pathname.lastIndexOf('/')+1];

export const mkdirP = (pathname) => readdir(pathname,{create:true});

export const readdir = async (pathname,options={ create: false }) => await pathname.split('/').reduce(
  async (dir,dirName) => (dir = await dir.getDirectoryHandle(dirName,options)),
  await navigator.storage.getDirectory()
).values;

// Can return file and Directory handels given a pathname
export const getFileHandle = async (pathname,options={create: false}) => {
  const [directoryName,fileName] = parsePath(pathname);
  return await (await readdir(directoryName),options))
    .getFileHandle(fileName),options);
};

// Can return a directory even if a filePath is given it returns the directoryHandle of the filePath
export const getDirectoryHandle = async (pathname,options={create: false}) => 
  await pathname.split('/').reduce(
    async (dir,dirName) => (dir = await dir.getDirectoryHandle 
      ? dir.getDirectoryHandle(dirName, options) 
      : dir),
    await navigator.storage.getDirectory()
  );

export const onrequest = async (request, sender, sendResponse) => {
  if (request.message?.startsWith('getDirectory')) {
    return await getDirectoryEntriesRecursive(
      request.data || '.',
      await navigator.storage.getDirectory(),
      sendResponse
    );
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
