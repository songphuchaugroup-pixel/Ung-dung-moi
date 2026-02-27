export type Shift = 'Sáng' | 'Chiều';
export type Evaluation = 'Tốt' | 'Khá' | 'Trung bình' | 'Chưa đạt';
export type DayOfWeek = 'Thứ 2' | 'Thứ 3' | 'Thứ 4' | 'Thứ 5' | 'Thứ 6' | 'Thứ 7';

export interface BusyTime {
  day: DayOfWeek;
  shift: Shift;
}

export interface ClassConfig {
  id: string;
  name: string;
  busyTimes: BusyTime[];
}

export interface DutyRecord {
  id: string;
  date: string;
  shift: Shift;
  className: string;
  mainTask: string;
  supervisor: string;
  evaluation: Evaluation;
  notes?: string;
}
