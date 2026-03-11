export type ObjectDetailParameter = {
  name: string;
  value: string;
};

export type ConnectedComponent = {
  id: string;
  label: string;
  category?: string;
};

export type ObjectDetails = {
  description: string;
  parameters: ObjectDetailParameter[];
  connectedComponents: ConnectedComponent[];
};
