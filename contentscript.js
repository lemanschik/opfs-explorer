export const handelsByPathname = {} 

export const getRelativePath = async (handle) => `./${(await root.resolve(handle)).join('/')}`;    

export const getDirectoryEntriesRecursive = (baseUrl,handle,sendResponse) => {
  const pathname = `${baseUrl}/${handle.name}`;
  // Storing handels by pathname for later lookups.
  handelsByPathname[pathname] = handle;
  const getEntrie = {
    async file() {
      const file = await handle.getFile();
      const entrie = {
          name: handle.name,
          kind: handle.kind,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          pathname,
        };
      sendResponse({ entrie });
      return entrie;
    },
    async directory() {
      return [handle.name,{
          name: handle.name,
          kind: handle.kind,
          pathname,
          entries: Object.fromEntries(await Promise.all((await handle.values()).map((nextHandle)=>
            getDirectoryEntriesRecursive(`${pathname}/${nextHandle.name}`,nextHandle,sendResponse)()
          ))),
      }];    
    }
  };
  return getEntrie[handle.kind]();
};

export const mkdirP = async (pathname) => pathname.split('/').reduce(
  (dir,dirName)=>dir.getDirectoryHandle(dirName,{ create: true }),
  await navigator.storage.getDirectory()
);

export const readdir = async (pathname) => pathname.split('/').reduce(
  (dir,dirName)=>dir?.getDirectoryHandle(dirName,{ create: false }),
  await navigator.storage.getDirectory()
).values

export const onrequest = async (request, sender, sendResponse) => {
  if (request.message?.startsWith('getDirectory')) {
    return await getDirectoryEntriesRecursive(
      await navigator.storage.getDirectory(),request.data||'.',sendResponse
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
