# haink Master DB v1

Imweb 상품 데이터를 중앙 "Master DB"로 적재하고, 발급된 `master_code`를 다시 Imweb에 푸시하기 위한 CLI 기반 워크플로우입니다. 모든 스크립트는 Node.js(Typescript) + Prisma(PostgreSQL) 조합으로 작성되었습니다.

## 요구 사항 정리
- 상품 PK는 UUID
- `issued_category_id` 단위로 5자리 시퀀스를 증가시키며 `master_code = {category}-{seq:05}`
- 카테고리/옵션/재고 정책은 모두 엄격 검증 (잘못된 데이터 발견 시 전체 배치를 중단)
- 외부 시스템 매핑(`external_product_map`)은 시스템별+external_id 유니크
- Imweb 푸시는 별도 배치 스크립트에서 처리 (Mock 클라이언트 내장)

## 초기 설정
1. Node.js 18+과 PostgreSQL을 준비합니다.
2. 의존성 설치:
   ```bash
   npm install
   ```
3. 환경 변수 파일 생성:
   ```bash
   cp .env.example .env
   # DATABASE_URL 값을 실제 Postgres 접속 문자열로 수정
   ```
4. Prisma 마이그레이션 및 클라이언트 생성:
   ```bash
   npx prisma migrate dev --name init
   npm run prisma:generate
   ```

## 주요 폴더 구조
```
prisma/                 # Prisma 스키마 및 초기 마이그레이션
scripts/                # CLI 진입점 (tsx 기반)
src/lib/                # 재사용 가능한 유틸/클라이언트/파서
reports/                # CLI 실행 시 생성되는 리포트(JSON/JSONL)
tests/                  # Vitest 단위 테스트
```

## Imweb 상품 엑셀 가져오기
엑셀 파일(`상품_전체_Feb_15_2026_KR.xlsx`)을 원하는 경로에 두고 아래 커맨드를 실행합니다.
```bash
npm run import:imweb -- \
  --file ./data/상품_전체_Feb_15_2026_KR.xlsx \
  --sheet "Sheet1" \
  --progress-interval 25
```
옵션 설명:
- `--file` (필수): 엑셀 경로
- `--sheet`: 시트명 (기본: 첫 시트)
- `--allow-existing`: 이미 IMWEB 매핑이 있는 경우 건너뛰고 계속 (기본: false → 즉시 중단)
- `--progress-interval`: 진행 로그 간격
- `--report`: 리포트 JSON 경로 (기본: `reports/imweb-import-타임스탬프.json`)

엄격 모드 예시
- `재고사용=N`인데 재고수가 입력되어 있다면 즉시 오류
- `옵션사용=Y`인데 필수 옵션명이 없거나 옵션값이 비어있으면 오류
- `master_code` 충돌 또는 이미 존재하는 외부 매핑도 오류 처리

출력:
- 성공/스킵/경고/오류 통계를 담은 JSON 리포트가 `reports/` 아래 생성

## Master Code Imweb 푸시 배치
```bash
npm run push:mastercode -- \
  --limit 200 \
  --rate-limit 5 \
  --concurrency 4 \
  --dry-run
```
옵션 설명:
- `--limit`: 최대 처리 건수 (기본 100)
- `--concurrency`: 동시 처리 수 (기본 3)
- `--rate-limit`: 초당 호출 수 제한 (기본 5)
- `--retries`: 실패 시 재시도 횟수 (기본 3, 지수 백오프)
- `--backoff-ms`: 초기 백오프 (기본 500ms)
- `--dry-run`: 실제 Imweb 호출/DB 업데이트 없이 로그만 남김
- `--only-unsynced`: 마지막 PUSH 이력이 없는 건만 대상으로 유지 (기본 true)
- `--report`: 결과 JSONL 경로 (기본: `reports/imweb-push-타임스탬프.jsonl`)

실제 API 연동이 준비되면 `src/lib/imwebClient.ts`의 `createImwebClient` 구현만 바꿔주면 됩니다. 현재는 Mock 클라이언트가 console 로그만 남깁니다.

## 웹 콘솔 (Next.js + shadcn)
Imweb 상품을 직접 등록/수정할 수 있는 Next.js 앱이 `apps/admin` 경로에 있습니다.

### 실행 방법
```bash
npm install          # 루트에서 의존성 설치 (이미 설치했다면 생략 가능)
npm run web:dev      # http://localhost:3000
```

프로덕션 빌드는 `npm run web:build` 후 `npm run web:start`를 사용합니다. Next.js 앱 역시 `.env`의 `DATABASE_URL`을 사용하므로 CLI와 동일한 DB를 바라봅니다.

### 주요 화면
- `/` : 최근 등록 상품 리스트 및 `master_code`/노출 상태 확인, 수정 페이지로 이동 가능
- `/products/new` : 수동 상품 등록 폼 (카테고리, 가격, 재고, 옵션뿐 아니라 `sot_mode`, 외부 매핑 URL, raw snapshot 등 Product/ExternalProductMap 컬럼 전부 입력 가능). 저장 시 `master_code`는 issued_category_id 규칙에 따라 자동으로 발급됩니다.
- `/products/[id]` : 기존 상품의 대부분 필드를 수정 가능. 옵션 값은 쉼표로 분리해 입력하면 되고, raw snapshot은 JSON 문자열을 그대로 붙여 넣으면 됩니다.

폼은 react-hook-form + zod 로 검증하고, shadcn(ui) 컴포넌트로 스타일링했습니다. API 라우트(`/api/products`, `/api/products/[id]`)는 Prisma를 통해 DB와 직접 통신하며, Excel import와 동일한 제약(카테고리 파싱, master_code 시퀀스, 외부 매핑 중복 확인 등)을 재사용합니다.

## Docker/Compose 실행
루트에는 웹 UI와 CLI를 각각 컨테이너로 실행할 수 있도록 `Dockerfile.web`, `Dockerfile.cli`, `docker-compose.yml`이 있습니다.

### 기본 사용
```bash
# 초기 빌드 및 실행 (웹 + DB)
docker compose up --build web db
```
- `web` 서비스: Next.js Admin (`npm run web:start`)을 3000번 포트로 노출합니다.
- `db` 서비스: Postgres 15 (`postgres/postgres` 계정, DB `imweb_master_db`).

### CLI/배치 실행
CLI 이미지는 별도 컨테이너(`cli`)로 준비되어 있으며, compose 명령으로 진입해 스크립트를 실행합니다.

```bash
# Prisma 마이그레이션
docker compose run --rm cli npm run prisma:migrate

# 엑셀 파일을 마운트해 Import 실행
docker compose run --rm \
  -v $(pwd)/row_data.xlsx:/data/row_data.xlsx \
  -e IMPORT_REPORT=/reports/import.json \
  cli \
  npm run import:imweb -- --file /data/row_data.xlsx --allow-existing
```
- `DATABASE_URL`은 자동으로 `postgresql://postgres:postgres@db:5432/imweb_master_db?schema=public` 로 설정됩니다.
- 외부 파일을 읽어야 하는 스크립트는 위 예시처럼 `-v` 옵션으로 마운트하거나, 컨테이너 이미지 안으로 사전에 복사해 두세요.
- `cli` 서비스는 기본적으로 `sleep infinity` 상태로 시작하므로, `docker compose exec cli <command>` 형태로도 작업할 수 있습니다.

## 상품 이미지 스토리지 (MVP)
- 컨테이너 내부에 이미지를 저장하지 않고, 호스트 디렉터리를 볼륨으로 마운트합니다. 기본 예시는 `./storage/images:/data/product-images`이며 운영 서버에서는 `/srv/master-images`처럼 별도 경로를 추천합니다.
- `.env` / 환경 변수
  - `PRODUCT_IMAGE_DIR`: 업로드 파일을 쌓아둘 **호스트 경로** (Docker에서는 `/data/product-images` 등으로 마운트).
  - `PRODUCT_IMAGE_MAX_SIZE_MB`: 업로드 허용 최대 용량 (기본 8MB).
  - `NEXT_PUBLIC_IMAGE_BASE_URL`: 정적 서버(Nginx 등)에서 위 디렉터리를 노출하는 퍼블릭 URL prefix (예: `https://trcfirm.co.kr/images`).
- Next.js Admin에는 `/api/uploads` 엔드포인트가 추가되어 있습니다. FormData(`file` 필드)에 이미지를 담아 POST하면 `storageKey`를 반환하며, 상품 폼에서 이 키를 그대로 DB에 저장합니다.
- DB의 `ProductImage` 테이블에는 `storage_key`만 저장합니다. 실제 URL은 클라이언트에서 `NEXT_PUBLIC_IMAGE_BASE_URL + '/' + storage_key`로 계산합니다.
- 정적 서빙은 Nginx 같은 별도 프로세스가 담당해야 합니다. 예시:
  ```nginx
  location /images/ {
      alias /srv/master-images/;
      add_header Cache-Control "public, max-age=31536000";
  }
  ```
  `/srv/master-images` 경로는 Docker 볼륨과 동일한 경로여야 하며, Next.js 앱은 파일을 스트리밍하지 않습니다.

## 테스트
카테고리 파서 & 옵션 canonicalizer에 대한 최소 단위 테스트가 포함되어 있습니다.
```bash
npm test
```

## 보고/로그 정책
- Import 스크립트 → JSON 리포트 (성공/경고/에러).
- Push 스크립트 → JSON Lines (항목별 성공/실패 및 메시지 기록).
- 두 스크립트 모두 `reports/` 폴더가 자동 생성되도록 `ensureDir` 유틸을 사용합니다.

## 추가 메모
- Docker Compose, 실제 API 연동은 v1 범위 밖이므로 Scaffold 하지 않았습니다.
- Excel 파싱은 `xlsx` 패키지를 사용하며, 첫 행을 헤더로 인식합니다.
- Prisma schema는 `prisma/migrations/20240215100000_init/`에 SQL로도 함께 커밋돼 있습니다.
