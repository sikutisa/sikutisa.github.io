---
tags: [database]
---

# NL조인
### 기본 메커니즘
* 사원과 고객 테이블에서 1996년 1월 1일 이후 입사한 사원이 관리하는 고객 데이터를 추출하려고 하는 경우

![img](./img/1.png){: w="30%"}

* 사원 테이블로부터 1996년 1월 1일 이후 입사한 사원을 찾고, *각 건마다* 고객 테이블에서 사원번호가 일치하는 레코드를 찾을 수 있음
    * Nested Loop 조인의 원리

```sql
begin 
    for outer in (select 사원번호, 사원명 from 사원 where 입사일자 >= '19960101')
    loop -- outer 루프
        for inner in (select 고객명, 전화번호 from 고객 where 관리사원번호 = outer.사원번호)
        loop -- inner 루프
            dbms_output.put_line(outer.사원명 || ' : ' || inner.고객명 || ' : ' || inner.전화번호);
        end loop; 
    end loop; 
end; 
```

* NL 조인은 Outer와 Inner 양쪽 테이블 모두 인덱스를 이용
    * Outer쪽 테이블 사이즈가 크지 않으면 인덱스를 이용하지 않을 수 있음
        * Table Full Scan을 하더라도 한 번에 그치기 때문
    * Inner는 인덱스를 사용해야 함
        * Inner 루프에서 인덱스를 사용하지 않으면, Outer 루프에서 읽은 건수만큼 Table Full Scan을 반복하기 때문

![img](./img/2.png){: w="30%"}
*Inner에서 인덱스를 사용하지 않는 경우*

* NL 조인은 **인덱스를 이용한 조인 방식**
* 예시
    * 가정
        * 사원 테이블에 입사일자 인덱스인 사원_X1이, 고객 테이블에 관리사원번호 인덱스인 고객_X1이 존재
    * 사원 테이블에서 탐색 과정
        * 사원_X1에서 입사일자 >= '19960101'인 첫 번째 레코드를 찾음
        * 인덱스에서 읽은 ROWID로 사원 테이블 레코드를 찾음
    * 고객 테이블에서 탐색 과정
        * 사원 테이블에서 읽은 사원번호로 고객_X1 인덱스 탐색
        * 고객_X1 인덱스에서 읽은 ROWID로 고객 테이블 레코드를 찾음
        * 사원 테이블에서 찾은 레코드의 사원번호를 기준으로, 고객_X1 인덱스를 계속 탐색(관리사원번호가 유니크가 아니기 때문)
    * 사원_X1에서 입사일자가 >= '19960101' 인 모든 레코드에 대해 위 과정을 반복

## NL 조인 실행계획 제어
* 위쪽 사원 테이블 기준으로 아래쪽 고객 테이블과 NL조인한다는 의미

```sql
Execution Plan
-----------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS
1  0    NESTED LOOPS
2  1      TABLE ACCESS (BY INDEX ROWID) OF '사원' (TABLE)
3  2        INDEX (RANGE SCAN) OF '사원_X1' (INDEX)
4  1      TABLE ACCESS (BY INDEX ROWID) OF '고객' (TABLE)
5  4        INDEX (RANGE SCAN) OF '고객_X1' (INDEX)
```

* use_nl 힌트로 NL조인 제어 가능
* ordered 힌트는 FROM 절에 기술한 순서대로 조인하라고 옵티마이저에게 지시할 때 사용

```sql
-- 사원 테이블(Driving 또는 Outer Table) 기준으로 고객 테이블(Inner Table)과 NL 조인하라
SELECT /*+ ORDERED USE_NL(C) */ *
FROM 사원 E, 고객 C
WHERE E.입사일자 >= '19960101'
AND C.관리사원번호 = E.사원번호

-- 3개 이상
-- A > B > C > D 순으로 조인하라
-- B와 조인할 때, 그리고 C와 이어서 조인할 때는 NL, D와 조인할 때는 해시 조인하라
SELECT /*+ ORDERED USE_NL(B) USE_NL(C) USE_HASH(D) */
FROM A, B, C, D
...

-- ordered 대신 leading 힌트를 사용해도 됨
-- from절을 바구지 않고도 순서를 제어 가능
SELECT /*+ LEADING(C, A, D, B) USE_NL(A) USE_NL(D) USE_HASH(B) */
FROM A, B, C, D

-- ordered나 leading힌트가 없으면, 순서는 옵티마이저가 스스로 판단
SELECT /*+ USE_NL(A, B, C, D) */
FROM A, B, C, D
...
```

## NL조인 수행 과정 분석
```sql
SELECT /*+ ORDERED USE_NL(C) INDEX(E) INDEX(C) */ *
FROM 사원 E, 고객 C
WHERE C.관리자사원번호 = E.사원번호
AND E.입사일자 >= '19960101'
AND E.부서코드 = 'Z123'
AND C.최종주문금액 >= 20000

/* 인덱스 구성 */
사원_PK : 사원번호, 사원_X1 : 입사일자
고객_PK : 고객번호, 고객_X1 : 관리사원번호, 고객_X2 : 최종주문금액
```

* index 힌트를 명시했으므로 인덱스를 이용해 엑세스
    * 어떤 인덱스를 사용할지는 옵티마이저가 결정

```sql
----------------------------------------------------------------------
| Id  | Operation                    | Name    | Rows  | Bytes | Cost |
----------------------------------------------------------------------
|   0 | SELECT STATEMENT             |        |     5 |    58 |    5 |
|   1 |  NESTED LOOPS                |        |     5 |    58 |    5 |
|   2 |   TABLE ACCESS BY INDEX ROWID| 사원    |     3 |    20 |    2 |
|   3 |    INDEX RANGE SCAN          | 사원_X1 |     5 |       |    1 |
|   4 |   TABLE ACCESS BY INDEX ROWID| 고객    |     5 |    76 |    2 |
|   5 |    INDEX RANGE SCAN          | 고객_X1 |     8 |       |    1 |
----------------------------------------------------------------------
```

* SQL 실행 순서
    * 사원_X1을 Range 스캔해 입사일자 조건에 맞는 레코드를 찾음 (ID = 3)
    * 사원_X1 인덱스에서 읽은 ROWID로 사원 테이블을 엑세스해서 부서코드 조건을 만족하는지 확인 (ID = 2)
    * 사원 테이블에서 읽은 사원번호 값으로 조인 조건을 만족하는 고객 레코드를 찾기 위해 고객_X1을 Range 스캔 (ID = 5)
    * 고객_X1 인덱스에서 읽은 ROWID로 고객 테이블을 엑세스해서 최종주문금액 필터 조건을 만족하는지 확인 (ID = 4)
* 각 단계를 모두 완료하고 다음 단계로 넘어가는 게 아니라, 한 레코드씩 순차적으로 진행함

![img](./img/3.png){: w="40%"}
*NL 조인 수행 절차*

* 11, 19, 31, 32는 스캔할 데이터가 더 있는지 확인하는 one-plus 스캔

## NL조인 튜닝 포인트
* 앞선 과정에서 첫 번째 튜닝 포인트는 사원_X1 인덱스를 읽고 사원 테이블을 엑세스하는 부분
    * 단일 컬럼 인덱스를 '>=' 조건으로 스캔했으므로 비효율 없이 (5 + 1)건을 읽었고, 그만큼만 테이블 랜덤 엑세스 발생
    * 만약 사원 테이블로 아주 많은 양의 랜덤 엑세스가 발생했고, 테이블에서 부서코드 조건에 의해 필터링되는 비율이 높은 경우
        * 사원_X1에 부서코드 컬럼을 추가하는 방안 고려
* 두 번째는 고객_X1 인덱스를 탐색하는 부분
    * 조인 엑세스 횟수가 많을수록 성능이 느려짐
        * 조인 엑세스 횟수는 Outer 테이블인 사원을 읽고 필터링한 결과 건수에 의해 결정
        * 만약 부서코드 조건을 만족하는 레코드가 100K이고, 고객_X1의 Depth가 3이라면, 300K의 블록을 읽어야 함
            * 리프 블록을 수평적으로 스캔하는 과정에서 추가적인 블록 I/O가 발생
* 세 번째는 고객_X1을 읽고 고객 테이블을 엑세스하는 부분
    * 최종주문금액 조건에 의해 필터링 되는 비율이 높다면, 고객_X1에 최종주문금액 컬럼을 추가하는 방안 고려
* 마지막은, 맨 처음 엑세스하는 사원_X1 인덱스에서 얻은 결과 건수에 의해 전체 일량이 좌우된다는 것
    * 사원_X1 인덱스를 스캔하면서 추출한 레코드가 많으면, 사원 테이블로 랜덤 엑세스하는 횟수, 고객_X1 인덱스를 탐색하는 횟수, 고객 테이블로 랜덤 엑세스하는 횟수가 전반적으로 많아짐

### 올바른 조인 메소드 선택
* OLTP 시스템에서는 일차적으로 NL 조인부터 고려
* 성능이 느리다면 NL 조인 튜닝 포인트에 따라 각 단계의 수행 일량 분석
    * 과도한 랜덤 엑세스가 발생하는 지점 파악
    * 조인 순서 변경해서 랜덤 엑세스 발생량을 줄일 수 있는지, 더 효과적인 인덱스가 있는지를 검토
    * 필요하다면 인덱스 추가 또는 구성 변경
* 만약 NL로 좋은 성능을 내기 어렵다고 판단되면 소트 머지 조인이나 해시 조인 검토

## NL조인 특징 요약
* **랜덤 엑세스 위주**의 조인
    * 레코드 하나를 읽으려고 블록을 통째로 읽기 때문에, 메모리 버퍼에서 빠르게 읽더라도 비효율이 존재
    * 인덱스 구성이 완벽해도, 대량 데이터 조인에 불리
* **한 레코드씩 순차적으로 진행**
    * 첫 번째 특징과 달리, 큰 테이블을 조인하더라도 매우 빠른 응답 속도를 낼 수 있게 함
        * 부분범위 처리가 가능한 상황에서 보여지는 특징

```sql
-- 부분범위 처리를 활용하면, 조회를 하자마자 결과 집합을 출력하기 시작
SELECT /*+ ORDERED USE_NL(B) INDEX_DESC(A (게시판구분, 등록일시)) */
FROM 게시판 A, 사용자 B
WHERE A.게시판구분 = 'NEWS' --게시판 IDX : 게시판 구분 + 등록일시
AND B.사용자ID = A.작성자ID
ORDER BY A.등록일시 DESC
```

* 순차적으로 진행하므로, 먼저 엑세스되는 테이블 처리 범위에 의해 전체 일량이 결정됨
* 다른 조인 방식에 비해 **인덱스 구성 전략이 중요**
    * 조인 컬럼에 대한 인덱스 유무, 컬럼 구성 방식에 따라 효율이 크게 달라짐
* NL 조인은 소량 데이터를 주로 처리하거나 부분범위 처리가 가능한 **OLTP 시스템에 적합**한 조인 방식

## NL조인 튜닝 실습
```sql
SELECT /*+ ORDERED USE_NL(C) INDEX(E) INDEX(C) */ *
FROM   사원 E, 고객 C
WHERE  C.관리사원번호 = E.사원번호
AND    E.입사일자    >= '19960101'
AND    E.부서코드    = 'Z123'
AND    C.최종주문금액 >= 20000
```

```sql
ROWS    ROW SOURCE OPERATION
------- -------------------------------------------------------
      5 NESTED LOOPS
      3   TABLE ACCESS BY INDEX ROWID OF 사원
   2780     INDEX RANGE SCAN OF 사원_X1
      5   TABLE ACCESS BY INDEX ROWID OF 고객
      8     INDEX RANGE SCAN OF 고객_X1
```

* 사원_X1 인덱스를 스캔하고서 사원 테이블을 엑세스한 횟수가 2,780
    * 테이블에서 부서코드 조건을 필터링한 결과는 3
    * 불필요한 테이블 엑세스를 많이 한 것
* 테이블을 엑세스한 후 필터링되는 비율이 높다면 인덱스에 테이블 필터 조건 컬럼을 추가하는 것을 고려
    * 사원_X1에 부서코드 컬럼을 추가했다고 가정

```sql
ROWS    ROW SOURCE OPERATION
------- -------------------------------------------------------
      5 NESTED LOOPS
      3   TABLE ACCESS BY INDEX ROWID OF 사원
      3     INDEX RANGE SCAN OF 사원_X1
      5   TABLE ACCESS BY INDEX ROWID OF 고객
      8     INDEX RANGE SCAN OF 고객_X1
```

* 테이블을 엑세스하기 전 인덱스 스캔 단계에서의 일량을 확인할 필요가 있음
    * cr: 논리적 블록 요청 횟수
    * pr: 디스크에서 읽은 블록 수
    * pw: 디스크에 쓴 블록 수

```sql
ROWS    ROW SOURCE OPERATION
------- -----------------------------------------------------------------------
      5 NESTED LOOPS (CR=112 PR=34 PW=0 TIME=122 US)
      3   TABLE ACCESS BY INDEX ROWID OF 사원 (CR=105 PR=32 PW=0 TIME=118 US)
      3     INDEX RANGE SCAN OF 사원_X1 (CR=102 PR=31 PW=0 TIME=16)
      5   TABLE ACCESS BY INDEX ROWID OF 고객 (CR=7 PR=2 PW=0 TIME=4 US)
      8     INDEX RANGE SCAN OF 고객_X1 (CR=5 PR=1 PW=0 TIME=0 US)
```

* 사원_X1 인덱스로부터 읽은 블록이 102개
    * 한 블록에 평균 500개 레코드가 있다고 가정
    * 인덱스에서 3건을 얻기 위해, 50,000개의 레코드를 읽은 것
* 사원_X1 인덱스 컬럼 순서를 (부서코드 + 입사일자) 순으로 조정

```sql
ROWS    ROW SOURCE OPERATION
------- -----------------------------------------------------------------------
      5 NESTED LOOPS (CR=2732 PR=386 PW=0 TIME=...)
   2780   TABLE ACCESS BY INDEX ROWID 사원 (CR=166 PR=2 PW=0 TIME=...)
   2780     INDEX RANGE SCAN 사원_X1 (CR=4 PR=0 PW=0 TIME=...)
      5   TABLE ACCESS BY INDEX ROWID 고객 (CR=2566 PR=384 PW=0 TIME=...)
      8     INDEX RANGE SCAN 고객_X1 (CR=2558 PR=383 PW=0 TIME=...)
```

* 사원 테이블을 읽는 부분에서는 비효율이 없음
    * 인덱스에서 스캔한 블록이 4개
    * 테이블을 엑세스하고서 필터링되는 레코드도 없음
    * 일량은 많지만 비효율은 없음
* 사원 테이블을 읽고 고객 테이블과 조인하는 횟수는 문제가 있음
    * 2780번 조인 시도를 했지만 조인에 성공하고 필터링까지 마친 최종 결과집합은 5건
* 조인 순서 변경을 고려해볼 수 있음
    * 최종주문금액 조건절에 부합하는 레코드가 별로 없다면 튜닝에 성공할 수도 있음
    * 반대의 결과가 나올 수도 있음
        * 사원으로부터 넘겨받은 사원번호와 최종주문금액 조건절을 조합했기에 고객과 조인 후에 5건으로 줄어든 것
            * 만약 조인 순서를 바꿔 최종주문금액 단독 조회하면, 데이터량이 2780건보다 많을 수도 있음
    * 순서 변경해도 별 소득이 없다면 조인 방식 변경을 검토

## NL조인 확장 매커니즘
* 테이블 Prefetch
    * 인덱스를 이용해 테이블을 엑세스하다가 디스크 I/O가 필요해지면, 이어서 곧 읽게 될 블록까지 미리 읽어서 버퍼캐시에 적재
* 배치 I/O
    * 디스크 I/O Call을 미뤘다가 읽을 블록이 일정량 쌓이면 한꺼번에 처리
* 두 기능 모두, 읽는 블록마다 건건이 I/O Call을 발생시키는 비효율을 줄이기 위해 고안

```sql
-- 전통적인 NL조인
ROWS    ROW SOURCE OPERATION
------- -------------------------------------------------------
      5 NESTED LOOPS
      3   TABLE ACCESS BY INDEX ROWID OF 사원
      5     INDEX RANGE SCAN OF 사원_X1
      5   TABLE ACCESS BY INDEX ROWID OF 고객
      8     INDEX RANGE SCAN OF 고객_X1

-- Prefetch 실행계획
-- Inner쪽 테이블에 대한 디스크 I/O 과정에서 테이블 Prefetch 기능이 작동할 수 있음을 표시
ROWS    ROW SOURCE OPERATION
------- -------------------------------------------------------
      5 TABLE ACCESS BY INDEX ROWID OF 고객
     12   NESTED LOOPS
      3     TABLE ACCESS BY INDEX ROWID OF 사원
      3       INDEX RANGE SCAN OF 사원_X1
      8     INDEX RANGE SCAN OF 고객_X1

-- 배치 I/O 실행계획
-- Inner 테이블에 대한 디스크 I/O 과정에서 배치 I/O 기능이 작동할 수 있음을 표시
ROWS    ROW SOURCE OPERATION
------- -------------------------------------------------------
      5 NESTED LOOPS
      8   NESTED LOOPS
      3     TABLE ACCESS BY INDEX ROWID OF 사원
      3       INDEX RANGE SCAN OF 사원_X1
      8     INDEX RANGE SCAN OF 고객_X1
      5   TABLE ACCESS BY INDEX ROWID OF 고객
```

* Inner쪽 테이블 블록을 모두 버퍼캐시에서 읽는다면 성능이나 데이터 출력 순서 차이는 없음
* *일부를 디스크에서 읽게 되면* 성능에 차이가 날 수 있음
    * 배치 I/O 실행계획이 나타날 때는 결과집합의 정렬 순서도 다를 수 있음

```sql
SELECT /*+ ORDERED USE_NL(B) */
       A.등록일시, A.번호, A.제목, B.회원명, A.게시판유형, A.질문유형
FROM (
    SELECT A.*, ROWNUM NO
    FROM (
        SELECT 등록일시, 번호, 제목, 작성자번호, 게시판유형, 질문유형
        FROM   게시판
        WHERE  게시판유형 = :TYPE
        ORDER BY 등록일시 DESC  -- 인덱스 구성 : 게시판유형 + 등록일시
    ) A
    WHERE ROWNUM <= (:PAGE * 10)
) A, 회원 B
WHERE A.NO >= (:PAGE-1)*10 + 1
AND   B.회원번호 = A.작성자번호
ORDER BY A.등록일시 DESC    -- 11G부터 여기에 ORDER BY를 명시해야 정렬 순서 보장
```

* 안쪽 인라인 뷰에서 등록일시 역순으로 정렬하고, 회원 테이블과는 한 건씩 순차적으로 진행하는 NL 방식을 조인
    * 배치 I/O가 작동하지 않으면 맨 바깥쪽 ORDER BY 절이 없어서 상관 없음
* 11g부터 NL 조인 결과집합이 항상 일정한 순서로 출력되기를 원한다면, 배치 I/O 기능이 작동하지 못하도록 힌트를 추가하거나 맨 바깥쪽 ORDER BY가 필요
    * 안쪽 ORDER BY는 Top N 쿼리를 구현하기 위한 것으로 제거하면 안 됨

## 자가진단
```sql
-- 인덱스
PRA_HST_STC_N1 : SALE_ORG_ID + STRD_GRP_ID + STRD_ID + STC_DT

-- 쿼리
SELECT *
FROM PRA_HST_STC A, ODM_TRMS B
WHERE A.SALE_ORG_ID = :sale_org_id
AND A.STRD_GRP_ID = B.STRD_GRP_ID
AND A.STRD_ID = B.STRD_ID
ORDER BY A.STC_DT DESC

-- 힌트: 아래처럼 inner 테이블 alias를 왼쪽에 기술하는 것이 자연스러움
SELECT *
FROM PRA_HST_STC A, ODM_TRMS B
WHERE A.SALE_ORG_ID = :sale_org_id
AND B.STRD_GRP_ID = A.STRD_GRP_ID
AND B.STRD_ID = A.STRD_ID
ORDER BY A.STC_DT DESC
```