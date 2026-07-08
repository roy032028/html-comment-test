# Filestage

HTML 파일을 업로드하고, 화면 특정 위치에 핀을 찍어 댓글을 남기며 팀과 공유하는 리뷰 도구입니다.

## 기능

- **HTML 업로드** — `.html` / `.htm` 파일 업로드 및 iframe 미리보기
- **핀 댓글** — 화면을 클릭해 핀을 추가하고 해당 위치에 피드백 작성
- **링크 공유** — 고유 URL로 팀원과 실시간(5초 폴링) 협업
- **이름 기반 참여** — 별도 로그인 없이 이름만 입력해 댓글 참여

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 사용 방법

1. 홈에서 **새 리뷰 시작하기** 클릭
2. 상단 **HTML 업로드** 버튼으로 파일 업로드
3. 이름 입력 후 **핀 추가** → 화면 클릭
4. 핀을 클릭해 댓글 작성
5. **링크 공유** 버튼으로 URL 복사 후 팀원에게 전달

## 기술 스택

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- SQLite (better-sqlite3 + Drizzle ORM)

## 데이터 저장

- DB: `data/filestage.db`
- 업로드 파일: `uploads/{projectId}/`
