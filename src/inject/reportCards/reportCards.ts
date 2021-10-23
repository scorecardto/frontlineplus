interface ClassAverage {
  value: number;
  name: string;
  include: boolean;
};

interface RawReportCardData {
  classes: Array<string>;
  averages: Array<ClassAverage>;
};

interface ReportCard {
  raw: RawReportCardData;
  classes: Map<string, ClassAverage>;
};

const getRawAverages = () => {
  const els = document.querySelectorAll('.linkStyle');
  const names = document.querySelectorAll('.borderLeftHeading');
  let i = 0;
  return Array.from(els).map((_, idx) => {
    const grade = els[idx] as HTMLElement;
    const c = names[i % 8] as HTMLElement;
    const value = parseInt(grade.innerText.trim());
    const res = {
      value,
      name: c.innerText.trim(),
      include: grade.parentElement?.style.backgroundColor !== 'rgb(221, 221, 221)',
    };
    i++;
    return res;
  });
};

const getRawClasses = () => {
  const els = document.querySelectorAll('.studentNameGrading');
  const re = /r[0-9]+td3/gi;
  return Array.from(els)
      .filter((i) => i.id.match(re))
      .map((i) => (i as HTMLElement).innerText);
};

const getClasses = (data: ReportCard) => {
  const m = new Map();
  data.raw.averages.forEach((_, idx) => {
    const i = Math.floor(idx / 8);
    const c = data.raw.averages.slice(i * 8, i * 8 + 8);
    m.set(data.raw.classes[i], c.filter((grade) => grade.include));
  });
  return m;
};

const parseReportCard = () => {
  const data: ReportCard = {
    raw: {
      classes: getRawClasses(),
      averages: getRawAverages(),
    },
    classes: new Map(),
  };

  data.classes = getClasses(data);

  console.log(`[FrontlinePlus] Finished loading class averages`);
};

window.addEventListener('load', parseReportCard);
