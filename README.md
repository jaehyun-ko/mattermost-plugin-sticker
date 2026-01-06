# Mattermost Custom Sticker Plugin

Mattermost용 커스텀 스티커 플러그인입니다. 이미지를 매번 업로드하지 않고 서버에서 렌더링하는 방식으로 스티커를 공유할 수 있습니다.

## 기능

- **스티커 피커 UI**: 채널 헤더의 스티커 버튼을 클릭하여 시각적으로 스티커 선택
- **슬래시 명령어**: `/sticker [이름]`으로 빠르게 스티커 전송
- **스티커 관리**: 모든 사용자가 스티커 추가 가능, 삭제는 본인 것만
- **검색 기능**: 스티커 이름으로 검색
- **효율적인 렌더링**: 메시지에 이미지 첨부 대신 ID만 저장하여 서버에서 렌더링

## 설치

### 요구 사항

- Mattermost Server 7.0.0 이상
- Go 1.21 이상
- Node.js 18 이상

### 빌드

```bash
# 전체 빌드 (모든 플랫폼)
make all

# 현재 플랫폼만 빌드 (개발용)
make dist-local
```

### 설치

1. `dist/com.example.sticker-0.1.0.tar.gz` 파일을 다운로드
2. Mattermost System Console > Plugins > Plugin Management로 이동
3. "Upload Plugin" 버튼 클릭
4. tar.gz 파일 업로드
5. 플러그인 활성화

## 사용법

### 스티커 피커

1. 채널의 메시지 입력 영역에서 스티커 버튼(이모지 아이콘) 클릭
2. 스티커 목록에서 원하는 스티커 클릭하여 전송
3. "Add" 버튼으로 새 스티커 추가

### 슬래시 명령어

| 명령어 | 설명 |
|--------|------|
| `/sticker [이름]` | 스티커 전송 |
| `/sticker list` | 스티커 목록 보기 |
| `/sticker add [이름]` | 스티커 추가 안내 |
| `/sticker delete [이름]` | 스티커 삭제 (본인 것만) |
| `/sticker help` | 도움말 |

### REST API

| 엔드포인트 | 메소드 | 설명 |
|-----------|--------|------|
| `/plugins/com.example.sticker/api/v1/stickers` | GET | 스티커 목록 |
| `/plugins/com.example.sticker/api/v1/stickers` | POST | 스티커 업로드 |
| `/plugins/com.example.sticker/api/v1/stickers/{id}` | DELETE | 스티커 삭제 |
| `/plugins/com.example.sticker/api/v1/stickers/{id}/image` | GET | 스티커 이미지 |
| `/plugins/com.example.sticker/api/v1/stickers/search?q=` | GET | 스티커 검색 |

## 설정

System Console > Plugins > Custom Sticker에서 설정:

- **Maximum Sticker Size (KB)**: 최대 스티커 이미지 크기 (기본: 1024KB)
- **Allowed Image Formats**: 허용된 이미지 포맷 (기본: png,gif,jpg,jpeg,webp)

## 개발

```bash
# 의존성 설치
cd webapp && npm install

# 서버 빌드
make server-local

# Webapp 빌드 (watch 모드)
make watch-webapp

# 배포 (환경변수 필요)
export MM_SERVICESETTINGS_SITEURL=http://localhost:8065
export MM_ADMIN_TOKEN=your-admin-token
make deploy
```

## 프로젝트 구조

```
mattermost-plugin-sticker/
├── plugin.json                 # 플러그인 매니페스트
├── server/
│   ├── plugin.go              # 메인 플러그인
│   ├── command.go             # 슬래시 명령어
│   ├── api.go                 # REST API
│   ├── sticker.go             # 스티커 모델
│   └── store.go               # KV Store
├── webapp/
│   └── src/
│       ├── index.tsx          # 플러그인 진입점
│       ├── components/
│       │   ├── StickerPicker.tsx
│       │   ├── StickerButton.tsx
│       │   └── StickerPost.tsx
│       ├── actions/api.ts
│       └── types/index.ts
├── Makefile
└── go.mod
```

## 라이선스

Apache 2.0
