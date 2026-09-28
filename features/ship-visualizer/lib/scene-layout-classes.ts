import { cn } from "@/lib/utils";

type ColumnState = {
  isOntologyMode: boolean;
  hasSelection: boolean;
  isDetailsExpanded: boolean;
  hasLiveSelection: boolean;
  isMobileCard: boolean;
};

/**
 * The scene's column. Below lg a sheet is an opaque panel across the bottom:
 * padding the column by its height keeps the ship centred in the space
 * left, instead of behind the sheet — short of it by 20px, so the scene shows
 * through the sheet's rounded corners. Otherwise room for the tab bar; in
 * Live data the tab's page scrolls under it.
 */
export function sceneColumnClass({ isOntologyMode, hasSelection, isDetailsExpanded, hasLiveSelection, isMobileCard }: ColumnState) {
  return cn(
    "relative flex min-w-0 flex-1 flex-col",
    "transition-[padding] duration-300 ease-out",
    isOntologyMode && hasSelection && (isDetailsExpanded ? "pb-[calc(80vh-20px)]" : "pb-[calc(45vh-20px)]"),
    hasLiveSelection && "pb-[calc(58vh-20px)]",
    isOntologyMode && !hasSelection && "pb-16",
    isMobileCard && "overflow-y-auto pb-16",
    "lg:overflow-visible lg:pb-0"
  );
}

/** The scene itself: below lg in Live data a card among the tab's content, or the whole screen. */
export function sceneBoxClass({ isMobileCard, isSceneExpanded }: { isMobileCard: boolean; isSceneExpanded: boolean }) {
  return cn(
    "relative min-h-0 w-full flex-1",
    isMobileCard &&
      !isSceneExpanded &&
      "max-lg:mx-4 max-lg:mt-1 max-lg:h-[300px] max-lg:w-auto max-lg:flex-none max-lg:overflow-hidden max-lg:rounded-3xl",
    isMobileCard && isSceneExpanded && "max-lg:fixed max-lg:inset-0 max-lg:z-40"
  );
}
