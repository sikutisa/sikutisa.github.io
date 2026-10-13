---
tags: [database]
---

# 소트가 발생하지 않도록 SQL 작성
## Union vs Union All
* Union을 사용하면 옵티마이저는 상단과 하단 두 집합 간 중복을 제거하려고 소트 작업 수행
* Union All은 중복을 확인하지 않고 두 집합을 단순 결합
* **될 수 있으면 Union All 사용**
    * Union 대신 Union All을 무턱대고 사용하면 결과 집합이 달라질 수 있으므로 주의
    * 데이터 모델에 대한 이해와 집합적 사고가 필수

```sql
-- 결제수단코드가 달라 집합 사이에 인스턴스 중복 가능성이 없으므로 
-- Union All로 대체 가능
select 결제번호, 주문번호, 결제금액, 주문일자 ...
from   결제
where  결제수단코드 = 'M' and 결제일자 = '20180316'
UNION
select 결제번호, 주문번호, 결제금액, 주문일자 ...
from   결제
where  결제수단코드 = 'C' and 결제일자 = '20180316'

Execution Plan
-----------------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS (Cost=4 Card=2 Bytes=106)
1    0   SORT (UNIQUE) (Cost=4 Card=2 Bytes=106)
2    1     UNION-ALL
3    2       TABLE ACCESS (BY INDEX ROWID) OF '결제' (TABLE) (Cost=1 ... )
4    3         INDEX (RANGE SCAN) OF '결제_N1' (INDEX) (Cost=1 Card=1)
5    2       TABLE ACCESS (BY INDEX ROWID) OF '결제' (TABLE) (Cost=1 ... )
6    5         INDEX (RANGE SCAN) OF '결제_N1' (INDEX) (Cost=1 Card=1)
```

```sql
-- 인스턴스 중복 가능성 있음
select 결제번호, 결제수단코드, 주문번호, 결제금액, 결제일자, 주문일자 ...
from   결제
where  결제일자 = '20180316'
UNION
select 결제번호, 결제수단코드, 주문번호, 결제금액, 결제일자, 주문일자 ...
from   결제
where  주문일자 = '20180316'

Execution Plan
-----------------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS (Cost=2 Card=2 Bytes=106)
1    0   SORT (UNIQUE) (Cost=2 Card=2 Bytes=106)
2    1     UNION-ALL
3    2       TABLE ACCESS (BY INDEX ROWID) OF '결제' (TABLE) (Cost=0 ... )
4    3         INDEX (RANGE SCAN) OF '결제_N2' (INDEX) (Cost=0 Card=1)
5    2       TABLE ACCESS (BY INDEX ROWID) OF '결제' (TABLE) (Cost=0 ... )
6    5         INDEX (RANGE SCAN) OF '결제_N3' (INDEX) (Cost=0 Card=1)
```

```sql
-- 위 쿼리를 이렇게 바꿔줄 경우, 중복 가능성이 없어짐
select 결제번호, 결제수단코드, 주문번호, 결제금액, 결제일자, 주문일자 ...
from   결제
where  결제일자 = '20180316'
UNION ALL
select 결제번호, 결제수단코드, 주문번호, 결제금액, 결제일자, 주문일자 ...
from   결제
where  주문일자 = '20180316'
and    결제일자 <> '20180316'

Execution Plan
-----------------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS (Cost=0 Card=2 Bytes=106)
1    0   UNION-ALL
2    1     TABLE ACCESS (BY INDEX ROWID) OF '결제' (TABLE) (Cost=0 Card=1 ... )
3    2       INDEX (RANGE SCAN) OF '결제_N2' (INDEX) (Cost=0 Card=1)
4    1     TABLE ACCESS (BY INDEX ROWID) OF '결제' (TABLE) (Cost=0 Card=1 ... )
5    4       INDEX (RANGE SCAN) OF '결제_N3' (INDEX) (Cost=0 Card=1)
```

### Exists 활용
* 중복 레코드를 제거할 목적으로 Distinct를 사용하면, 조건에 해당하는 데이터를 모두 읽어서 중복을 제거해야 함
    * 부분범위 처리 불가
    * 모든 데이터를 읽는 과정에서 많은 I/O

```sql
-- 계약_X2가 (상품번호 + 계약일자) 일 때
select DISTINCT p.상품번호, p.상품명, p.상품가격, ...
from   상품 p, 계약 c
where  p.상품유형코드 = :pclscd
and    c.상품번호 = p.상품번호
and    c.계약일자 between :dt1 and :dt2
and    c.계약구분코드 = :ctpcd

Execution Plan
-----------------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS (Cost=3 Card=1 Bytes=80)
1    0   HASH (UNIQUE) (Cost=3 Card=1 Bytes=80)
2    1     FILTER
3    2       NESTED LOOPS
4    3         NESTED LOOPS (Cost=2 Card=1 Bytes=80)
5    4           TABLE ACCESS (BY INDEX ROWID) OF '상품' (TABLE) (Cost=1 ... )
6    5             INDEX (RANGE SCAN) OF '상품_X1' (INDEX) (Cost=1 Card=1)
7    4           INDEX (RANGE SCAN) OF '계약_X2' (INDEX) (Cost=1 Card=1)
8    3         TABLE ACCESS (BY INDEX ROWID) OF '계약' (TABLE) (Cost=1 ... )
```

* 상품유형코드 조건절에 해당하는 상품에 대해 계약일자 조건 기간에 발생한 계약 데이터를 모두 읽음
    * 상품 수는 적고 상품별 게약 건수가 많을수록 비효율

```sql
select p.상품번호, p.상품명, p.상품가격, ...
from   상품 p
where  p.상품유형코드 = :pclscd
and    EXISTS (select 'x' from 계약 c
               where c.상품번호 = p.상품번호
               and   c.계약일자 between :dt1 and :dt2
               and   c.계약구분코드 = :ctpcd)

Execution Plan
-----------------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS (Cost=2 Card=1 Bytes=80)
1    0   FILTER
2    1     NESTED LOOPS (SEMI) (Cost=2 Card=1 Bytes=80)
3    2       TABLE ACCESS (BY INDEX ROWID) OF '상품' (TABLE) (Cost=1 Card=1 ... )
4    3         INDEX (RANGE SCAN) OF '상품_X1' (INDEX) (Cost=1 Card=1)
5    2       TABLE ACCESS (BY INDEX ROWID) OF '계약' (TABLE) (Cost=1 Card=1 ... )
6    5         INDEX (RANGE SCAN) OF '계약_X2' (INDEX) (Cost=1 Card=1)
```

* Exists 서브쿼리는 데이터 존재 여부만 확인하면 되므로 조건절을 만족하는 데이터를 모두 읽지 않음
    * 조건절을 만족하는 데이터가 한 건이라도 존재하는지만 확인
    * 상품 테이블에 대한 부분범위 처리도 가능

```sql
-- < 튜닝 전 >
SELECT ST.상황접수번호, ST.관제일련번호, ST.상황코드, ST.관제일시
FROM   관제진행상황 ST
WHERE  상황코드 = '0001' -- 신고접수
AND    관제일시 BETWEEN :V_TIMEFROM || '000000' AND :V_TIMETO || '235959'
MINUS
SELECT ST.상황접수번호, ST.관제일련번호, ST.상황코드, ST.관제일시
FROM   관제진행상황 ST, 구조활동 RPT
WHERE  상황코드 = '0001'
AND    관제일시 BETWEEN :V_TIMEFROM || '000000' AND :V_TIMETO || '235959'
AND    RPT.출동센터ID = :V_CNTR_ID
AND    ST.상황접수번호 = RPT.상황접수번호
ORDER BY 상황접수번호, 관제일시;

-- < 튜닝 후 >
SELECT ST.상황접수번호, ST.관제일련번호, ST.상황코드, ST.관제일시
FROM   관제진행상황 ST
WHERE  상황코드 = '0001' -- 신고접수
AND    관제일시 BETWEEN :V_TIMEFROM || '000000' AND :V_TIMETO || '235959'
AND    NOT EXISTS (SELECT 'X' FROM 구조활동
                   WHERE  출동센터ID = :V_CNTR_ID
                   AND    상황접수번호 = ST.상황접수번호)
ORDER BY ST.상황접수번호, ST.관제일시;
```

### 조인 방식 변경
```sql
-- 계약_X01 인덱스가 (지점ID + 계약일시) 순이면 소트연산 생략 가능
-- 해시 조인이기 때문에 Sort Order By 나타남
select c.계약번호, c.상품코드, p.상품명, p.상품구분코드, c.계약일시, c.계약금액
from   계약 c, 상품 p
where  c.지점ID = :brch_id
and    p.상품코드 = c.상품코드
order by c.계약일시 desc

Execution Plan
-------------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS
1    0   SORT (ORDER BY)
2    1     HASH JOIN
3    2       TABLE ACCESS (FULL) OF '상품' (TABLE)
4    2       TABLE ACCESS (BY INDEX ROWID) OF '계약' (TABLE)
5    4         INDEX (RANGE SCAN) OF '계약_X01' (INDEX)

-- 계약 테이블 기준으로 NL 조인하도록 변경
-- 정렬 기준이 조인 키 컬럼이면 소트 머지 조인도 Sort Order By 연산 생략 가능
select /*+ leading(c) use_nl(p) */
       c.계약번호, c.상품코드, p.상품명, p.상품구분코드, c.계약일시, c.계약금액
from   계약 c, 상품 p
where  c.지점ID = :brch_id
and    p.상품코드 = c.상품코드
order by c.계약일시 desc

Execution Plan
-------------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS
1    0   NESTED LOOPS
2    1     NESTED LOOPS
3    2       TABLE ACCESS (BY INDEX ROWID) OF '계약' (TABLE)
4    3         INDEX (RANGE SCAN DESCENDING) OF '계약_X01' (INDEX)
5    2       INDEX (UNIQUE SCAN) OF '상품_PK' (INDEX (UNIQUE))
6    1     TABLE ACCESS (BY INDEX ROWID) OF '상품' (TABLE)
```