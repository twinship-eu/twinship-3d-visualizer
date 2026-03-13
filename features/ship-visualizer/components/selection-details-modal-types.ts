export type ObjectDetailParameter = {
  name: string;
  value: string;
  href?: string;
};

export type ConnectedComponent = {
  id: string;
  label: string;
  category?: string;
};

export type ObjectDetails = {
  title?: string;
  titleHref?: string;
  tags?: string[];
  description: string;
  parameters: ObjectDetailParameter[];
  connectedComponents: ConnectedComponent[];
};
