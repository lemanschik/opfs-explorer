const Handels = {} 

const getRelativePath = async (handle) => `./${(await root.resolve(handle)).join('/')}`;    

const getDirectoryEntriesRecursive = (pathname,handle,sendResponse) => ({
  file(handle,pathname) {
    return handle.getFile().then((file) => {
      return {
        name: handle.name,
        kind: handle.kind,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        pathname,
      };
    })
  },
  async directory(handle,pathname) {
    Handels[`${pathname}/${handle.name}`] = handle;
    const entrie = [handle.name,{
        name: handle.name,
        kind: handle.kind,
        pathname,
        entries: Object.fromEntries(await Promise.all((await handle.values()).map((nextHandle)=>
          getDirectoryEntriesRecursive(`${pathname}/${nextHandle.name}`,nextHandle,sendResponse)()
        ))),
    }];
    //sendResponse({ entrie });
    return entrie;
  }
})[handle.kind];

const onrequest = async (request, sender, sendResponse) => {
  if (request.message?.startsWith('getDirectory')) {
    await getDirectoryEntriesRecursive(
      await navigator.storage.getDirectory(),request.data||'.',sendResponse
    );
  } else if (request.message?.startsWith('save') === 'saveFile') {
    const fileHandle = Handles[request.data];
    //const fileIsDirectory = false
    // Todo if it is a directory we need to sync overwrite or do what so ever
    try {
      const handle = await showSaveFilePicker({
        suggestedName: fileHandle.name,
      });

      (await fileHandle.getFile()).stream().pipeTo(await handle.createWritable());

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error.name, error.message);
      }
    }
  } else if (request.message?.startsWith('delete')) {
    try {
      await Handles[request.data].remove();
      sendResponse({ result: 'ok' });
    } catch (error) {
      console.error(error.name, error.message);
      sendResponse({ error: error.message });
    }
  }
};

const browser = chrome || globalThis.browser;
browser.runtime.onMessage.addListener((request, sender, sendResponse) =>
  onrequest(request, sender, sendResponse) || true
);
