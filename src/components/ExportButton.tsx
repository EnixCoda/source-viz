import { ChevronDownIcon } from "@chakra-ui/icons";
import { Button, Menu, MenuButton, MenuItem, MenuList } from "@chakra-ui/react";
import { DependencyEntry, entrySerializers } from "../services/serializers";
import { download } from "../utils/general";

export function ExportButton({ data }: { data: DependencyEntry[] | null }) {
  return (
    <Menu>
      <MenuButton disabled={!data} as={Button} rightIcon={<ChevronDownIcon />}>
        Export scan result
      </MenuButton>
      <MenuList>
        <MenuItem
          onClick={() => {
            if (data) download(entrySerializers.csv(data), "records.csv");
          }}
        >
          Export as CSV
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (data) download(entrySerializers.json(data), "records.json");
          }}
        >
          Export as JSON
        </MenuItem>
      </MenuList>
    </Menu>
  );
}
