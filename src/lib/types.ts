export interface Comment {
  id: string;
  pinId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Pin {
  id: string;
  fileId: string;
  xPercent: number;
  yPercent: number;
  // 요소 기반 앵커: 클릭한 DOM 요소의 선택자 + 요소 내 상대 위치(0~1)
  selector: string | null;
  offsetX: number | null;
  offsetY: number | null;
  authorName: string;
  createdAt: string;
  comments: Comment[];
}

export interface ProjectFile {
  id: string;
  projectId: string;
  filename: string;
  createdAt: string;
  pinCount: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  files: ProjectFile[];
}

export interface FileReview {
  file: ProjectFile;
  pins: Pin[];
}
