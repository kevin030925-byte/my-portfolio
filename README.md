# 이승민 · 사회학,경영학 포트폴리오

**Seungmin Lee · Sociology&Business Administration Portfolio**

사회 현상을 관찰하고 기록하고 그를 기반으로 경영철학을 세우는 이승민의 개인 포트폴리오 및 PDF·MP4 자료실입니다.  
기존 `Paper — PDF Book Reader`의 PDF 책장 넘김 뷰어(PDF.js + PageFlip)와 로컬 PDF 열기 기능을 보존하면서, 정적 포트폴리오 및 자료실 구조로 재구성했습니다.

> **안내**: 본 웹사이트는 이승민 개인 포트폴리오이며 한림대학교 공식 페이지가 아닙니다.

---

## 파일 구조

```text
.
├── index.html          # 메인 HTML 문서 (소개, 자료실, PDF 뷰어, 내 PDF 열기, 연락하기)
├── styles.css          # 아이보리·차콜·딥 네이비·세이지 기반 반응형 스타일 및 뷰어 테마
├── app.js              # content.json 로드/필터/검색, MP4 재생, 공통 Paper PDF 뷰어 엔진
├── content.json        # 공개 자료 목록 데이터 (기본값: 빈 배열 [])
├── README.md           # 저장소 운영, GitHub/Netlify 배포, 주의사항 안내
├── 사용법.txt           # 초보자용 마크다운 단계별 사용 안내서
└── media/
    ├── pdf/            # 공개 게시할 PDF 파일 업로드 폴더
    └── video/          # 공개 게시할 MP4 파일 업로드 폴더
```

---

## 1. GitHub 웹 UI에서 텍스트 파일 만들기

별도 Git 명령어나 빌드 도구 없이 GitHub 웹사이트만으로 파일을 올릴 수 있습니다.

1. GitHub에서 새 저장소(예: `my-portfolio`)를 만듭니다.
2. 저장소 상단의 **Add file → Create new file**을 클릭합니다.
3. 파일 이름 입력칸에 `index.html`을 입력하고, `index.html` 전체 코드를 붙여넣은 뒤 **Commit changes...**를 누릅니다.
4. 같은 방식으로 `styles.css`, `app.js`, `content.json`, `README.md` 파일을 각각 생성해 붙여넣고 커밋합니다.
5. `content.json`의 초기값은 반드시 유효한 빈 배열 `[]`로 저장합니다.

---

## 2. PDF · MP4 바이너리 파일 업로드하기

브라우저는 보안상 GitHub/Netlify의 폴더 목록을 자동으로 탐색할 수 없습니다.  
따라서 새 자료를 공개하려면 **① 실제 파일 업로드**와 **② `content.json` 수동 등록**을 모두 해야 합니다.

1. GitHub 저장소에서 **Add file → Create new file**을 눌러 경로 입력칸에 `media/pdf/.gitkeep` 또는 `media/video/.gitkeep`을 입력해 폴더를 미리 만들거나, 파일 업로드 시 경로에 들어간 상태에서 업로드합니다.
2. 해당 폴더(`media/pdf/` 또는 `media/video/`)로 이동한 뒤 **Add file → Upload files**를 클릭합니다.
3. PDF 또는 MP4 파일을 드래그해 올리고 **Commit changes**를 누릅니다.
4. 파일명은 공백이나 특수문자 대신 영문·숫자·하이픈(`-`)을 권장합니다 (예: `2026-observation-report.pdf`, `2026-field-note.mp4`).

---

## 3. `content.json`에 실제 자료 추가 예시

파일을 업로드한 뒤 루트의 `content.json`을 수정(연필 아이콘 클릭)하여 아래 형식으로 항목을 추가합니다.  
**PDF 1건 + MP4 1건**을 등록하는 예시는 다음과 같습니다.

```json
[
  {
    "id": "pdf-2026-01",
    "type": "pdf",
    "title": "지역 상권 관찰 기록 보고서",
    "category": "사회학 보고서",
    "description": "현장 관찰을 통해 기록한 자료를 정리한 PDF 보고서입니다.",
    "date": "2026-11-25",
    "url": "media/pdf/observation-report.pdf"
  },
  {
    "id": "video-2026-01",
    "type": "video",
    "title": "현장 기록 요약 영상",
    "category": "영상 기록",
    "description": "직접 촬영 및 편집한 MP4 영상 자료입니다.",
    "date": "2026-11-25",
    "url": "media/video/field-summary.mp4"
  }
]
```

### 필드 설명
- `id` *(필수, 중복 불가)*: 각 자료의 고유 식별자 문자열. 중복된 `id`가 있으면 안전을 위해 후속 항목이 제외됩니다.
- `type` *(필수)*: `"pdf"` 또는 `"video"` 중 하나만 사용합니다.
- `title` *(필수)*: 카드에 표시되는 제목이자 제목 검색 대상입니다.
- `url` *(필수)*: 저장소 상대 경로(`media/pdf/...`, `media/video/...`) 또는 `https://` 주소.
- `category`, `description`, `date` *(선택)*: 분류 태그, 짧은 설명, 작성일.
- 외부 동영상 플랫폼(예: YouTube, Vimeo)의 시청 페이지 주소를 넣을 때는 직접 MP4로 재생하지 않고 공식 임베드(`iframe`) 또는 새 탭 열기 링크로 안전하게 연결됩니다.

---

## 4. Netlify 배포 설정

이 사이트는 순수 HTML/CSS/JS/JSON 정적 사이트이므로 빌드 과정이 필요 없습니다.

1. [Netlify](https://www.netlify.com/)에 로그인 후 **Add new site → Import an existing project**를 선택합니다.
2. **GitHub**를 연결하고 포트폴리오 저장소를 선택합니다.
3. 빌드 설정을 아래처럼 입력합니다.
   - **Branch to deploy**: `main`
   - **Build command**: *(비워 둠 / 없음)*
   - **Publish directory**: `.` *(저장소 루트)*
4. **Deploy site**를 눌러 배포를 시작합니다.

---

## 5. 로컬 검수와 Netlify 배포 검수의 차이

- **`file://` 직접 열기 (파일 더블 클릭)**:
  - Chrome/Edge 등 최신 브라우저는 보안 정책(CORS)으로 인해 `file://` 경로에서 `fetch('./content.json')` 요청을 차단합니다.
  - 따라서 `index.html`을 탐색기에서 더블 클릭해 열면 `content.json` 안내 배너가 표시되며 공개 카드 목록은 비어 보일 수 있습니다. 단, **‘내 PDF 열기’** 기능은 브라우저 내부 파일 선택(`File.arrayBuffer()`)을 사용하므로 로컬에서도 동작합니다.
- **로컬 HTTP 서버 검수**:
  - 터미널에서 `python -m http.server 8000` 또는 VS Code **Live Server**로 `http://localhost:8000`을 열어 확인하면 `content.json`과 동일 출처 PDF/MP4가 실제 서버와 동일하게 동작합니다.
- **Netlify 배포 검수**:
  - HTTPS 환경과 실제 CDN(`pdf.js`, `page-flip`), 실제 저장소 경로 대소문자 구분(Linux 기반 서버는 파일명 대소문자를 엄격히 구분함)까지 최종 검증할 수 있습니다.

---

## 6. 배포 실패 및 오류 점검표

1. **`content.json`을 불러오지 못하거나 형식이 잘못되었다는 오류가 날 때**
   - JSON 마지막 항목 뒤에 불필요한 쉼표(`,`)가 남아 있지 않은지 확인하세요.
   - 문자열은 반드시 큰따옴표(`"`)를 사용해야 합니다.
   - 파일이 저장소 루트(`./content.json`)에 있는지 확인하세요.
2. **PDF나 MP4가 404 오류로 열리지 않을 때**
   - `content.json`의 `url` 경로와 실제 파일명(대소문자, 확장자 포함)이 정확히 일치하는지 확인하세요.
   - GitHub에 파일은 올렸는데 `content.json`을 수정하지 않았는지 확인하세요.
3. **외부 URL PDF가 책 뷰어에서 열리지 않을 때**
   - 외부 서버가 CORS를 허용하지 않으면 브라우저가 `fetch`를 차단합니다. 이 경우 뷰어에 표시되는 **‘PDF 원본 열기’** 버튼으로 문서를 열거나, PDF를 저장소 `media/pdf/`에 직접 올려 동일 출처로 제공하세요.
4. **MP4가 재생되지 않을 때**
   - 브라우저 호환성이 높은 **H.264(MP4) + AAC** 코덱인지 확인하세요.
   - 유튜브 링크를 MP4 파일처럼 다루지 않았는지 확인하세요.

---

## 7. 용량 제한 · 개인정보 · 저작권 주의사항

- **GitHub 웹 브라우저 업로드 제한**: GitHub 웹사이트의 파일 업로드 기능은 **파일당 최대 25MiB**까지만 허용됩니다.
- **Netlify 10MB 초과 파일 배포 위험**: 정적 호스팅에 **10MB를 초과하는 대용량 PDF/MP4**를 직접 포함하면 배포 속도 저하, 타임아웃, 대역폭 소진이나 일부 네트워크 환경에서의 로딩 실패 위험이 커집니다. 고화질·장시간 영상은 용량을 압축하거나 YouTube 등의 공식 플랫폼 업로드 후 링크/임베드로 연결하는 방식을 권장합니다.
- **학번 및 이메일 공개 노출 위험**: 요청에 따라 소개·연락처·푸터 영역에 학번(`20222228`)과 이메일(`iseungmini80@gmail.com`)을 공개 표시했습니다. 공개 웹사이트 및 공개 GitHub 저장소에 게시될 경우 검색 엔진 수집, 스팸 메일, 사칭이나 개인정보 결합 위험이 있으므로 필요 시 언제든 노출 범위를 조정하시기 바랍니다.
- **저작권 및 초상권 점검**: 게시하는 모든 PDF 보고서, 이미지, 폰트, 동영상(배경음악·강의자료·타인 초상 포함)은 본인이 저작권을 보유했거나 배포 허가를 받은 자료인지 업로드 전에 반드시 확인하세요.
