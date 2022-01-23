export interface Cell {
  value: string;
  type: string,
}

export interface SharedStrings {
  xml: string;
  set: Set<string>;
}

export interface GridBounds {
  rows: string;
  cols: string;
}

export interface Course {
  teacher: string;
  courseCode: string;
  grades: Grades;
}

export interface Assignment {
  name: string;
  grade: number;
}

export interface Section {
  name: string;
  average: number;
  weight: number;
  assignments: Array<Assignment>;
}

export interface Grades {
  [key: string]: {
    average: number;
    sections: Array<Section>;
  }
}

export interface Content {
  [key: string]: Course;
}

export type Sheet = {
  name: string;
  cells: Array<Array<Cell>>
};
