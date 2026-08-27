# LOST ARK RAID CHECKER

GitHub Pages에 바로 배포할 수 있는 로스트아크 주간 레이드 체크 웹앱입니다.

## 현재 포함된 레이드
- 벨가르딘: 노말 / 하드 / 나이트메어
- 지평의 성당: 노말 / 하드 / 나이트메어
- 종막: 노말 / 하드
- 세르카: 노말 / 하드 / 나이트메어

## 기능
- 캐릭터 추가 / 삭제
- 캐릭터별 레이드 난이도 체크
- 브라우저 자동 저장(localStorage)
- 주간 진행도 표시
- 목요일 기준 주간 표기 및 새 주 자동 초기화
- 현재 현황 텍스트 복사
- 전체 체크 수동 초기화
- 모바일 반응형

## GitHub Pages 배포
1. GitHub에서 새 Repository를 만듭니다.
2. 이 폴더 안의 `index.html`, `style.css`, `script.js`를 업로드합니다.
3. Repository의 Settings → Pages로 이동합니다.
4. Build and deployment에서 `Deploy from a branch`를 선택합니다.
5. Branch를 `main`, 폴더를 `/ (root)`로 선택하고 저장합니다.
6. 잠시 후 표시되는 GitHub Pages 주소로 접속합니다.

## 주의
현재 버전은 브라우저의 localStorage에 저장되므로, 같은 링크를 여러 사람이 열어도 체크 내용이 실시간으로 공유되지는 않습니다.
여러 사람이 같은 체크표를 동시에 수정하려면 Firebase 또는 Supabase 연동 버전으로 확장해야 합니다.
