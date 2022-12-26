import { figures, gameResult } from "../const/const";

export type WinStatus = keyof typeof gameResult;

export type Figure = keyof typeof figures;

export interface IPlayer {
  name: string;
  ready: boolean;
  result: null | number;
  image: null | string;
  win: null | WinStatus;
}

export type Players = Array<[string, IPlayer]>;
