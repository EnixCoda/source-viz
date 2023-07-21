import { SmallCloseIcon } from "@chakra-ui/icons";
import { Button, IconButton, List, ListItem, VStack, useCallbackRef } from "@chakra-ui/react";
import { useEffect } from "react";
import { IIFC } from "react-iifc";
import { useRegExpInputView } from "../../hooks/view/useRegExpInputView";

function FilterInput({ value, onChange }: { value: string; onChange(value: string): void }) {
  const [view, , v] = useRegExpInputView({ defaultValue: value, inputProps: { value } });
  useEffect(() => {
    onChange(v);
  }, [onChange, v]);
  return <>{view}</>;
}

export function FilterInputList({ values, onChange }: { values: string[]; onChange(values: string[]): void }) {
  return (
    <VStack direction="column">
      <List display="inline-flex" flexDirection="column" maxHeight={600} gap={1} paddingLeft={1}>
        {values.map((value, index) => (
          <ListItem key={index} display="inline-flex" gap={1}>
            <IIFC>
              {() => {
                // eslint-disable-next-line react-hooks/rules-of-hooks
                const onChangeX = useCallbackRef((value: string) =>
                  onChange(values.map((v, j) => (index === j ? value : v))),
                );
                return <FilterInput value={value} onChange={onChangeX} />;
              }}
            </IIFC>
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
