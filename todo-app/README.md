# 경영전략그룹 Daily To do List

실시간 협업이 가능한 업무 관리 애플리케이션입니다.

## 🎯 주요 기능

- ✅ **실시간 동기화**: 모든 팀원이 변경 사항을 실시간으로 확인
- 👥 **다중 담당자**: 한 업무에 여러 담당자 지정 가능
- 📝 **세부 Action Items**: 각 업무별 세부 항목 관리
- 💬 **댓글 시스템**: 댓글, 답글, 이모지 반응 지원
- 🎨 **직관적인 UI**: 파스텔 보라색 테마의 깔끔한 디자인
- 📱 **반응형 디자인**: PC/모바일 모두 지원

## 🚀 배포 방법

### 옵션 1: Railway (추천 - 무료, 간편)

1. **Railway 계정 생성**
   - https://railway.app 접속
   - GitHub 계정으로 로그인

2. **프로젝트 배포**
   - "New Project" 클릭
   - "Deploy from GitHub repo" 선택
   - 이 코드를 업로드한 저장소 선택

3. **환경 변수 설정** (선택)
   - Settings → Variables에서 PORT 설정 가능 (기본값: 3000)

4. **완료!**
   - 배포된 URL을 팀원들과 공유하세요

### 옵션 2: Render (무료)

1. https://render.com 접속 및 로그인
2. "New +" → "Web Service" 선택
3. GitHub 저장소 연결
4. 설정:
   - Name: strategy-todo (원하는 이름)
   - Build Command: `npm install`
   - Start Command: `npm start`
5. "Create Web Service" 클릭

### 옵션 3: 로컬 서버 실행

```bash
# 1. 프로젝트 폴더로 이동
cd todo-app

# 2. 의존성 설치
npm install

# 3. 서버 실행
npm start

# 4. 브라우저에서 접속
# http://localhost:3000
```

### 옵션 4: 회사 서버에 배포

1. Node.js가 설치된 서버에 파일 업로드
2. 위의 로컬 서버 실행 방법대로 설치 및 실행
3. PM2를 사용하여 백그라운드 실행 권장:
   ```bash
   npm install -g pm2
   pm2 start server.js --name todo-app
   pm2 save
   pm2 startup
   ```

## 📁 파일 구조

```
todo-app/
├── server.js        # 백엔드 서버 (Express + WebSocket)
├── package.json     # 의존성 설정
├── public/          # 프론트엔드 파일
│   ├── index.html   # 메인 HTML
│   ├── styles.css   # 스타일시트
│   └── app.js       # 프론트엔드 JavaScript
└── README.md        # 이 파일
```

## 🔧 기술 스택

- **Backend**: Node.js, Express, SQLite
- **Frontend**: HTML, CSS, JavaScript
- **Real-time**: WebSocket
- **Database**: SQLite (파일 기반, 별도 DB 설치 불필요)

## 💡 사용 방법

### 업무 추가
1. 업무명, 상태, 우선순위, 마감일 입력
2. 담당자 드롭다운에서 여러 명 선택
3. "업무 추가" 버튼 클릭

### 업무 관리
- 업무 카드 클릭으로 상세 내용 펼침
- ✏️ 버튼으로 수정
- 🗑️ 버튼으로 삭제

### 담당자 관리
- ⚙️ 버튼 클릭으로 담당자 추가/수정/삭제

## 🌐 팀원 공유

배포 후 생성된 URL을 팀원들에게 공유하면:
- 모든 팀원이 동일한 데이터 확인 가능
- 누군가 수정하면 실시간으로 모두에게 반영
- 별도의 데이터 동기화 작업 불필요

## ⚠️ 주의사항

- SQLite 데이터베이스는 서버의 로컬 파일에 저장됩니다
- 데이터 백업을 원하면 `todolist.db` 파일을 주기적으로 복사하세요
- Railway/Render 무료 플랜에서는 일정 기간 사용 없으면 서버가 슬립 상태가 됩니다 (첫 접속 시 약간 느릴 수 있음)

## 📞 문의

개발팀에 문의하세요.

---

경영전략그룹을 위해 제작되었습니다.