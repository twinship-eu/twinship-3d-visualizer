export type ObjectDetailParameter = {
  name: string;
  value: string;
  href?: string;
  /** The ontology property it shows, by its local name (twShaftPowerMaxInKW), when from the knowledge graph. */
  property?: string;
};

export type ObjectDetails = {
  title?: string;
  titleHref?: string;
  tags?: string[];
  description: string;
  parameters: ObjectDetailParameter[];
};
