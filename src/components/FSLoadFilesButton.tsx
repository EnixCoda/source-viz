import { Button, ButtonProps } from "@chakra-ui/react";
import { resolvePath } from "../utils/general";
import { FS } from "./App";
// import { FSItemDir } from "./FileExplorer";

export function FSLoadFilesButton({
  onLoad,
  buttonProps,
  children = buttonProps?.children,
}: {
  onLoad: (fs: FS | null) => void;
  buttonProps?: ButtonProps;
  children?: ButtonProps["children"];
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, "accept">) {
  return (
    <Button
      {...buttonProps}
      onClick={async () => {
        const { showDirectoryPicker } = window;
        const isSupported = !!showDirectoryPicker;
        if (!isSupported) {
          alert("Please use Chrome/Edge");
          return;
        }

        const handle = await showDirectoryPicker();
        if (handle) onLoad({ handle, pathMap: new Map() });
      }}
    >
      {children}
    </Button>
  );
}

// function getFS() {
//   const map = new Map<string, FSItemDir>([
//     [
//       "",
//       {
//         contents: [],
//         kind: "dir",
//         name: "",
//         path: "",
//       },
//     ],
//   ]);

// for (const file of files) {
//   const path = file.webkitRelativePath;
//   const chunks = path.split("/");

//   const slots: string[] = [];
//   for (let i = 0; i < chunks.length; ++i) {
//     slots.push(i === 0 ? chunks[i] : slots[slots.length - 1] + "/" + chunks[i]);
//   }

//   console.log({ path, slots });

//   // get parent dir
//   let last: FSItemDir | undefined;
//   const parent = (() => {
//     for (let i = slots.length - 1; i > 0; --i) {
//       last = map.get(chunks[i]);
//       if (last) return i;
//     }
//     last = map.get("");
//     return 0;
//   })();

//   for (let i = parent + 1; i < slots.length; ++i) {
//     if (i === slots.length) {
//       const item: $FSItem = {
//         kind: "file",
//         name: slots[slots.length - 1],
//         path,
//         file,
//       };
//       last?.contents.push(item);
//       last = undefined;
//     } else {
//       const item: FSItemDir = {
//         kind: "dir",
//         name: chunks[i],
//         path,
//         contents: [],
//       };
//       map.set(path, item);
//       last?.contents.push(item);
//       last = item;
//     }
//   }
// }

//   return map.get("");
// }

export async function getFiles(handle: FileSystemDirectoryHandle, isExcluded?: (path: string) => boolean) {
  const files: File[] = [];

  async function scan(handle: FileSystemHandle, relativePath: string) {
    if (isExcluded?.(relativePath)) return;

    if (handle instanceof FileSystemDirectoryHandle) {
      console.info(`checking ${handle.name}`);
      const items = handle.values();
      for await (const item of items) {
        await scan(item, resolvePath(relativePath, item.name));
      }
    } else if (handle instanceof FileSystemFileHandle) {
      files.push(await handle.getFile());
    } else {
      console.error(`Unrecognized item type "${relativePath}"`);
    }
  }

  await scan(handle, ".");

  return files;
}
