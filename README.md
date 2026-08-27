# LOST ARK RAID CHECKER — 실시간 공유 버전

GitHub Pages + Firebase로 여러 사람이 같은 공격대 체크표를 실시간으로 함께 수정할 수 있는 웹앱입니다.

## 레이드 / 난이도
- 벨가르딘: 노말 / 하드 / 나이트메어
- 지평의 성당: 1단계 / 2단계 / 3단계
- 종막: 노말 / 하드
- 세르카: 노말 / 하드 / 나이트메어

## 기능
- 6자리 공격대 코드 자동 생성
- 공격대 코드로 같은 체크표 입장
- 초대 링크 복사 (`?room=ABC123`)
- 여러 명이 같은 체크표를 실시간으로 수정
- 캐릭터 추가 / 삭제
- 캐릭터별 레이드 체크
- 목요일 기준 주차 표시
- 새 주 진입 시 해당 공격대 체크 자동 초기화
- 전체 진행도 표시
- 현재 현황 텍스트 복사
- 수동 전체 초기화
- 모바일 반응형

# 1. Firebase 설정

실시간 공유를 위해 Firebase 프로젝트를 한 번 만들어야 합니다.

1. https://console.firebase.google.com 에서 프로젝트를 만듭니다.
2. 프로젝트 개요에서 `</>` 웹 앱을 추가합니다.
3. 표시되는 `firebaseConfig` 값을 복사합니다.
4. 이 폴더의 `firebase-config.js`를 열어 각 값을 붙여넣습니다.

예시:
```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "프로젝트.firebaseapp.com",
  projectId: "프로젝트ID",
  storageBucket: "프로젝트.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

> 웹용 Firebase config 값은 GitHub Pages에 들어가도 되는 공개 식별값입니다. 실제 접근 통제는 아래 Firestore Rules에서 합니다.

# 2. 익명 로그인 켜기

Firebase Console에서:

`Authentication → Sign-in method → Anonymous → 사용 설정`

# 3. Firestore Database 만들기

Firebase Console에서:

`Firestore Database → 데이터베이스 만들기`

위치는 가까운 리전을 선택하면 됩니다.

그 다음 `Rules` 탭에 아래 규칙을 넣고 게시합니다.

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, create, update: if request.auth != null;
      allow delete: if false;

      match /characters/{characterId} {
        allow read, create, update, delete: if request.auth != null;
      }
    }
  }
}
```

이 규칙은 **로그인된 익명 사용자만** 데이터를 읽고 수정할 수 있게 합니다. 다만 공격대 코드를 아는 사람이라면 해당 방을 수정할 수 있으므로, 공격대 코드는 신뢰하는 사람에게만 공유하세요.

# 4. GitHub Pages 배포

GitHub 저장소에 아래 4개 파일을 업로드합니다.

- `index.html`
- `style.css`
- `script.js`
- `firebase-config.js`

그리고:

1. Repository → `Settings`
2. `Pages`
3. Build and deployment → `Deploy from a branch`
4. Branch: `main`
5. Folder: `/ (root)`
6. Save

GitHub Pages 주소가 생성되면 접속해서 사용할 수 있습니다.

# 사용법

1. 첫 화면에서 `새 공격대 만들기`를 누릅니다.
2. 6자리 코드가 생성됩니다.
3. `초대 링크 복사`를 눌러 친구들에게 보냅니다.
4. 링크로 들어온 사람은 같은 공격대 체크표를 바로 볼 수 있습니다.
5. 한 사람이 체크하거나 캐릭터를 추가/삭제하면 다른 사람 화면에도 실시간으로 반영됩니다.

예:
`https://내아이디.github.io/lostark-raid-checker/?room=A7K29F`

# 참고

현재 버전에는 별도의 방 비밀번호나 관리자 권한은 없습니다. 공격대 코드를 아는 사용자는 같은 권한으로 캐릭터 추가/삭제와 체크 변경을 할 수 있습니다.
