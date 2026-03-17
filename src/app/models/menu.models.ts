import { Collection } from "./collection.models";
import { MediaCollection } from "./media-collection.models";

export interface MainMenuNode {
  nodeId?: string;
  children?: MainMenuNode[];
  id?: string;
  title?: string;
  parentPath?: string;
  menuType?: string;
};

export interface MainMenuGroupNode {
  menuType: string;
  menuData: MainMenuNode[];
}

export interface CollectionTocPathNode {
  id: string;
  leaf: boolean;
}

export interface MdMenuNodeApiResponse {
  basename: string;
  children?: MdMenuNodeApiResponse[];
  fullpath: string;
  id: string;
  path: string;
  route: string;
  title: string;
  type: string;
}

export const fromMdToMainMenuNode = (
  md: MdMenuNodeApiResponse,
  parentPath?: string
): MainMenuNode => {
  const node: MainMenuNode = {
    id: md.id,
    title: md.title,
    parentPath
  };

  if (md.children?.length) {
    node.children = md.children.map(child =>
      fromMdToMainMenuNode(child, parentPath)
    );
  }

  return node;
};

export const fromCollectionToMainMenuNode = (
  c: Collection,
  parentPath?: string
): MainMenuNode => ({
  id: String(c.id),
  title: c.title,
  parentPath
});

export const fromMediaCollectionToMainMenuNode = (
  mc: MediaCollection,
  parentPath?: string
): MainMenuNode => ({
  id: String(mc.id),
  title: mc.title,
  parentPath
});
