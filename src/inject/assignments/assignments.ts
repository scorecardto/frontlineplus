interface StringIndex<T> {
  [key: string]: T;
};

interface Assignment {
  name: string;
  type: string;
  value: number;
  dropped: boolean;
  assignDate: Date;
  dueDate: Date;
  maximumValue: number;
  count: number;
  note: string;
};

interface RawClassReportCardData {
  categories: Array<Category>;
  assignments: Array<Array<Assignment>>;
};

interface ClassReportCard {
  raw: RawClassReportCardData;
  categories: Map<string, Category>;
};

interface Category {
  name: string;
  average: number;
  weight: number;
  assignments?: Array<Assignment>;
};

const getRawAssignments = () => {
  const els = document.querySelectorAll('.tblBody');
  return Array.from(els)
      .map((el) => (el as HTMLElement).innerText.split('\n'))
      .map((assignments) => {
        return assignments
            .map((assignment) => {
              const [name, gradeValue, dropped, assignDate, dueDate, gradeScale, maximumValue, count, note] = assignment.split('\t');

              const specials: StringIndex<number> = {
                'MSG': 0,
                'PND': 100,
                'EXC': 100,
                'NG': 0,
              };
              const specialsRegex = new RegExp(Object.keys(specials).join('|'), 'gi');

              const parseGradeValue = (gradeValue: string) => {
                if (gradeValue.trim().length < 1) return specials['NG'];
                const percentage = /\([0-9]{1,3}.[0-9]{1,3}%\)/gi;
                const n = parseFloat(gradeValue.replace(percentage, '').trim());
                const type = gradeValue.toUpperCase();
                return type.match(specialsRegex) ? specials[type] : n;
              };

              const determineGradeType = (gradeValue: string) => {
                if (gradeValue.trim().length < 1) return 'NG';
                return gradeValue.match(specialsRegex) ? gradeValue.toUpperCase() : 'NML';
              };

              return {
                name: name,
                type: determineGradeType(gradeValue),
                value: parseGradeValue(gradeValue),
                dropped: dropped === 'Yes' ? true : false,
                assignDate: new Date(assignDate),
                dueDate: new Date(dueDate),
                gradeScale: parseInt(gradeScale),
                maximumValue: parseInt(maximumValue),
                count: parseInt(count),
                note: note.trim(),
              };
            });
      });
};

const getRawCategories = () => {
  const els = document.querySelectorAll('.sst-header');
  return Array.from(els)
      .map((el) => (el as HTMLElement).innerText
          .split('\n')
          .slice(0, 3)
      ).map((category) => {
        const [name, average, weight] = category;
        const re = /(Average|Weight):/gi;
        return {
          name: name,
          average: parseInt(average.replace(re, '').trim()),
          weight: parseInt(weight.replace(re, '').trim()),
        };
      });
};

const getCategories = (data: ClassReportCard) => {
  const m = new Map();
  const {raw: {assignments, categories}} = data;
  let i = 0;
  categories.forEach((category) => {
    const res = {
      ...category,
      assignments: assignments[i],
    };
    i++;
    m.set(category.name, res);
  });
  return m;
};

const parseClassReportCard = async () => {
  const data: ClassReportCard = {
    raw: {
      categories: getRawCategories(),
      assignments: getRawAssignments(),
    },
    categories: new Map(),
  };

  data.categories = getCategories(data);

  console.log(`[FrontlinePlus] Finished loading assignments`);
};

window.addEventListener('load', parseClassReportCard);
