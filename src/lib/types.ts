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
