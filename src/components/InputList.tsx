import { SmallCloseIcon } from "@chakra-ui/icons";
import { Button, IconButton, Input, List, ListItem, VStack } from "@chakra-ui/react";

export function InputList({ values, onChange }: { values: string[]; onChange(values: string[]): void }) {
  return (
    <VStack direction="column">
      <List display="inline-flex" flexDirection="column" maxHeight={600} gap={1}>
        {values.map((value, index) => (
          <ListItem key={index} display="inline-flex" gap={1}>
            <Input
              value={value}
              placeholder="glob pattern, like **/folder/**"
              onChange={(e) => onChange(values.map((value, j) => (index === j ? e.target.value : value)))}
            />
            <IconButton
              onClick={() => onChange(values.filter((_, j) => j !== index))}
              icon={<SmallCloseIcon />}
              aria-label="Remove"
            />
          </ListItem>
        ))}
      </List>
      <Button onClick={() => onChange(values.concat(""))}>Add</Button>
    </VStack>
  );
}
