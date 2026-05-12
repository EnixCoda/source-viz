import {
  Box,
  HStack,
  IconButton,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { MdHistory } from "react-icons/md";
import * as React from "react";
import {
  RecentProject,
  forgetProject,
  listRecentProjects,
  queryHandlePermission,
  rememberProject,
  requestHandlePermission,
} from "../lib/recentProjects";

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function RecentProjects({
  enabled,
  onOpen,
}: {
  enabled: boolean;
  onOpen: (handle: FileSystemDirectoryHandle) => void;
}) {
  const [items, setItems] = React.useState<RecentProject[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const list = await listRecentProjects();
    setItems(list);
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    refresh();
  }, [enabled, refresh]);

  const handleOpen = React.useCallback(
    async (project: RecentProject) => {
      setBusyId(project.id);
      try {
        let perm = await queryHandlePermission(project.handle);
        if (perm !== "granted") {
          perm = await requestHandlePermission(project.handle);
        }
        if (perm === "granted") {
          await rememberProject(project.handle);
          onOpen(project.handle);
        } else {
          // Permission denied — let the user retry or remove
          await refresh();
        }
      } catch (err) {
        console.warn("[RecentProjects] open failed:", err);
      } finally {
        setBusyId(null);
      }
    },
    [onOpen, refresh]
  );

  const handleForget = React.useCallback(
    async (project: RecentProject, e: React.MouseEvent) => {
      e.stopPropagation();
      await forgetProject(project.id);
      refresh();
    },
    [refresh]
  );

  if (!enabled || !items || items.length === 0) return null;

  return (
    <VStack alignItems="stretch" spacing={2} w="100%">
      <Text fontSize="xs" fontWeight="bold" color="gray.600" textTransform="uppercase">
        Recent projects
      </Text>
      <VStack alignItems="stretch" spacing={1}>
        {items.map((p) => (
          <HStack
            key={p.id}
            spacing={2}
            px={3}
            py={2}
            borderWidth="1px"
            borderRadius="md"
            borderColor="gray.200"
            _hover={{ borderColor: "blue.300", bg: "blue.50" }}
            cursor="pointer"
            onClick={() => handleOpen(p)}
          >
            <Box as={MdHistory} fontSize="lg" color="gray.500" flexShrink={0} />
            <VStack alignItems="flex-start" spacing={0} flex={1} minW={0}>
              <Text fontSize="sm" fontWeight="medium" isTruncated maxW="100%">
                {p.name}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {formatRelative(p.lastOpenedAt)}
              </Text>
            </VStack>
            {busyId === p.id ? (
              <Spinner size="xs" />
            ) : (
              <Tooltip label="Forget this project" hasArrow openDelay={400}>
                <IconButton
                  aria-label="Forget project"
                  size="xs"
                  variant="ghost"
                  icon={<CloseIcon boxSize="0.6em" />}
                  onClick={(e) => handleForget(p, e)}
                />
              </Tooltip>
            )}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

/** Helper used by FSLoadFilesButton callers to also persist the handle. */
export async function persistOpenedHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await rememberProject(handle);
}

// Re-export helper for components that want it without importing from lib.
