# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **상태: 골격(skeleton).** 이 리포지토리는 아직 소스 코드가 없는 초기 상태입니다.
> 아래 `TBD` 항목은 실제 코드/설정이 생기는 시점에 채웁니다.
> 스캐폴딩이 끝나면 `/init`을 다시 실행해 명령어와 아키텍처 섹션을 갱신하세요.

## Commands

<!-- 아직 package.json / 빌드 설정이 없어 확정된 명령이 없음 -->

| 목적 | 명령 | 비고 |
|------|------|------|
| 설치 | TBD | 패키지 매니저 미정 |
| 개발 서버 | TBD | |
| 빌드 | TBD | |
| 타입체크 | TBD | |
| 린트 / 포맷 | TBD | |
| 전체 테스트 | TBD | |
| 단일 테스트 | TBD | 파일/테스트명 단위 실행 방법 명시 |

## Architecture

<!-- 여러 파일을 읽어야 파악되는 "큰 그림"만 기록. 파일 목록 나열 금지. -->

TBD — 다음이 정해지면 기록:

- 이 템플릿이 무엇을 위한 템플릿인지 (생성 대상 프로젝트의 형태)
- 모듈/패키지 경계와 의존 방향
- 템플릿 변수 치환·스캐폴딩이 일어나는 지점
- 외부 시스템(API, 지도/타일 서버, 인증 등) 연동 경계

## Conventions

TBD — 코드가 생기면 실제 코드에서 관찰되는 규칙만 기록 (일반론 금지).

## Environment

- 개발 환경은 **Windows**입니다. 셸 명령은 PowerShell 문법 또는 크로스 플랫폼 호환 형태로 제시하세요.
- 경로 구분자와 줄바꿈(CRLF/LF) 차이에 주의합니다.

## Repository state

- `main` 브랜치에 아직 커밋이 없습니다. 첫 커밋 시 스캐폴딩과 설정을 함께 넣으세요.
- `.gitignore`는 Node/TypeScript 기준으로 작성되어 있습니다. 다른 스택을 선택하면 함께 갱신하세요.
- `.bkit/`은 bkit 플러그인(PDCA 워크플로)의 **로컬 도구 상태**이며 전체가 gitignore 대상입니다.
  머신 종속 절대경로를 담고 세션마다 재작성되므로 커밋하지 마세요.
  주의: 현재 내용은 **다른 프로젝트**(`forest-digital-platform-frontend`)에서 넘어온 이력이라
  이 리포지토리와 무관합니다. bkit이 세션 시작 시 엉뚱한 이전 작업(`viewshed`) 재개를 제안할 수 있습니다.
