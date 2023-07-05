import {
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionItemProps,
  AccordionPanel,
  Box,
  Heading,
} from "@chakra-ui/react";

export function CollapsibleSection({
  label,
  alwaysRender,
  children,
}: {
  label: string;
  alwaysRender?: boolean;
  children: AccordionItemProps["children"];
}) {
  return (
    <AccordionItem>
      {(...args) => {
        const [{ isExpanded }] = args;
        return (
          <>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                <Heading as="h2" size="md">
                  {label}
                </Heading>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel>
              {alwaysRender || isExpanded ? (typeof children === "function" ? children(...args) : children) : null}
            </AccordionPanel>
          </>
        );
      }}
    </AccordionItem>
  );
}
