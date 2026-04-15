---
tags: [database]
---

# Sort Area를 적게 사용하도록 SQL 작성
## 소트 데이터 줄이기
```sql
-- 1번
select lpad(상품번호, 30) || lpad(상품명, 30) || lpad(고객ID, 10)
    || lpad(고객명, 20) || to_char(주문일시, 'yyyymmdd hh24:mi:ss')
from   주문상품
where  주문일시 between :start and :end
order by 상품번호

-- 2번
select lpad(상품번호, 30) || lpad(상품명, 30) || lpad(고객ID, 10)
    || lpad(고객명, 20) || to_char(주문일시, 'yyyymmdd hh24:mi:ss')
from (
    select 상품번호, 상품명, 고객ID, 고객명, 주문일시
    from   주문상품
    where  주문일시 between :start and :end
    order by 상품번호
)
```

* 1번은 레코드당 107 바이트로 가공한 결과집합을 Sort Area에 담음
* 2번은 가공하지 않은 상태로 정렬을 완료하고 나서 최종 출력할 때 가공
* 2번이 Sort Area 적게 사용

```sql
-- 1번
SELECT *
FROM   예수금원장
ORDER BY 총예수금 desc

Execution Plan
---------------------------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS (Cost=184K Card=2M Bytes=716M)
1  0     SORT (ORDER BY) (Cost=184K Card=2M Bytes=716M)
2  1       TABLE ACCESS (FULL) OF '예수금원장' (TABLE) (Cost=25K Card=2M Bytes=716M)

-- 2번
SELECT 계좌번호, 총예수금
FROM   예수금원장
ORDER BY 총예수금 desc

Execution Plan
---------------------------------------------------------------------------------------
0      SELECT STATEMENT Optimizer=ALL_ROWS (Cost=31K Card=2M Bytes=17M)
1  0     SORT (ORDER BY) (Cost=31K Card=2M Bytes=17M)
2  1       TABLE ACCESS (FULL) OF '예수금원장' (TABLE) (Cost=24K Card=2M Bytes=17M)
```

* 1번은 모든 컬럼을 Sort Area에 저장
* 2번은 계좌번호와 총예수금만 저장
    * 실행계획 맨 우측열에 처리한 Bytes 확인
* 테이블을 Full Scan해 읽은 데이터량은 같으나, 소트한 데이터량이 달라 성능도 다름

## Top N 쿼리의 소트 부하 경감 원리
* 인덱스로 소트 연산을 생략할 수 없을 때, Top N 쿼리가 어떻게 동작하는지
* 예시
    * 전교생 1000명 중 가장 큰 학생 10명 선발하는 경우
    * 전교생을 키 순서대로 정렬한 학생명부가 있는 경우
        * 가장 위쪽에 있는 10명 선발
        * Top N Stopkey
    * 없는 경우
        * 전교생을 집합
        * 맨 앞줄 맨 왼쪽에 있는 10명을 앞으로 불러 키 순서대로 정렬
        * 나머지 990명을 한 명씩 교실로 보내면서 앞에 있는 학생과 비교
            * 더 큰 학생이 나타나면, 교체
            * 새로 진입한 학생 키에 맞춰 재배치
        * 이 방식을 Top N 소트라고 하자

```sql
select *
from (
    select rownum no, a.*
    from
    (
        select 거래일시, 체결건수, 체결수량, 거래대금
        from   종목거래
        where  종목코드 = 'KR123456'
        and    거래일시 >= '20180304'
        order by 거래일시
    ) a
    where  rownum <= (:page * 10)
)
where no >= (:page-1)*10 + 1

Call        Count CPU Time Elapsed Time      Disk      Query    Current    Rows
------- --------- -------- ------------ --------- ---------- ---------- -------
Parse           1    0.000        0.000         0          0          0       0
Execute         1    0.000        0.000         0          0          0       0
Fetch           2    0.078        0.083         0        690          0      10
------- --------- -------- ------------ --------- ---------- ---------- -------
Total           4    0.078        0.084         0        690          0      10

Rows  Row Source Operation
----- -----------------------------------------------------------------------
    0 STATEMENT
   10  COUNT STOPKEY (cr=690 pr=0 pw=0 time=83318 us)
   10   VIEW (cr=690 pr=0 pw=0 time=83290 us)
   10    SORT ORDER BY STOPKEY (cr=690 pr=0 pw=0 time=83264 us)
49857     TABLE ACCESS FULL 종목거래(cr=690 pr=0 pw=0 time=299191 us)
```

* 실행계획에 Sort Order By 오퍼레이션 나타남
    * Table Full Scan 대신 종목코드가 선두인 인덱스를 사용할 수도 있음
    * 바로 뒤 컬럼이 거래일시가 아니면 소트 연산을 생략할 수 없으므로
* Stopkey 오퍼레이션을 통해, 소트 연산을 생략할 수 없지만 Top N 소트 가 작동함을 알 수 있음
    * 소트 연산 횟수와 Sort Area 사용량을 최소화
    * page 변수에 1을 입력하면, 10개의 결과를 담을 배열 공간만 있으면 됨
    * 10개짜리 배열로 최상위 10개 레코드를 찾는 방법은 앞서 설명한 예시와 동일
* 대상 집합이 아무리 커도 많은 메모리 공간이 필요하지 않음
    * 전체 레코드를 다 정렬하지 않고도 오름차순으로 최소값을 값는 10개 레코드를 찾을 수 있음


```sql
Statistics
---------------------------
0  recursive calls
0  db block gets
690  consistent gets
0  physical reads
...  ...
1  sorts (memory)
0  sorts (disk)
```

* AutoTrace를 보면 Physical Read(pr)과 Physical Write(pw)가 전혀 발생하지 않음
    * physical reads, sorts(disk) 항목이 0

## Top N 쿼리가 아닐 때 발생하는 소트 부하
```sql
select *
from (
    select rownum no, a.*
    from
    (
        select 거래일시, 체결건수, 체결수량, 거래대금
        from   종목거래
        where  종목코드 = 'KR123456'
        and    거래일시 >= '20180304'
        order by 거래일시
    ) a
)
where no between (:page-1)*10 + 1 and (:page * 10)

Call        Count CPU Time Elapsed Time      Disk      Query    Current    Rows
------- --------- -------- ------------ --------- ---------- ---------- -------
Parse           1    0.000        0.000         0          0          0       0
Execute         1    0.000        0.000         0          0          0       0
Fetch           2    0.281        0.858       698        690         14      10
------- --------- -------- ------------ --------- ---------- ---------- -------
Total           4    0.281        0.858       698        690         14      10

Rows  Row Source Operation
----- -----------------------------------------------------------------------
    0 STATEMENT
   10  VIEW (cr=690 pr=698 pw=698 time=357962 us)
49857   COUNT (cr=690 pr=698 pw=698 time=1604327 us)
49857    VIEW (cr=690 pr=698 pw=698 time=1205452 us)
49857     SORT ORDER BY (cr=690 pr=698 pw=698 time=756723 us)
49857      TABLE ACCESS FULL 종목거래(cr=690 pr=0 pw=0 time=249345 us)
```

* 실행 계획에서 Stopkey가 사라짐
    * Top N 소트 작동하지 않음
    * Physical Read(pr=698)과 Physical Write(pw=698) 발생
        * 같은 양의 데이터를 읽고 정렬을 수행했는데, 메모리 내에서 정렬을 완료하지 못하고 디스크 사용

```sql
Statistics
---------------------------
6  recursive calls
14  db block gets
690  consistent gets
698  physical reads
...  ...
0  sorts (memory)
1  sorts (disk)
```

* sorts(disk)가 1
    * 정렬 과정에서 Temp 테이블스페이스를 이용했다는 의미

## 분석함수에서의 Top N 소트
* rank나 row_number 함수는 max보다 소트 부하가 적음
    * Top N 소트가 작동하기 때문

```sql
select 장비번호, 변경일자, 변경순번, 상태코드, 메모
from (select 장비번호, 변경일자, 변경순번, 상태코드, 메모
           , max(변경순번) over (partition by 장비번호) 최종변경순번
      from   상태변경이력
      where  변경일자 = :upd_dt)
where 변경순번 = 최종변경순번

Call        Count CPU Time Elapsed Time      Disk      Query    Current    Rows
------- --------- -------- ------------ --------- ---------- ---------- -------
Parse           1    0.000        0.000         0          0          0       0
Execute         1    0.000        0.000         0          0          0       0
Fetch           2    2.750        9.175     13456       4536          9      10
------- --------- -------- ------------ --------- ---------- ---------- -------
Total           4    2.750        9.175     13456       4536          9      10

Rows  Row Source Operation
----- -----------------------------------------------------------------------
    0 STATEMENT
   10  VIEW (cr=4536 pr=13456 pw=8960 time=4437847 us)
498570  WINDOW SORT (cr=4536 pr=13456 pw=8960 time=9120662 us)
498570   TABLE ACCESS FULL 상태변경이력 (cr=4536 pr=0 pw=0 time=1994341 us)
```

* Window Sort 단계에서 13456개 physical read(pr)과 8960개 physical write(pw) 발생

```sql
select 장비번호, 변경일자, 변경순번, 상태코드, 메모
from (select 장비번호, 변경일자, 변경순번, 상태코드, 메모
           , rank() over(partition by 장비번호 order by 변경순번 desc) rnum
      from   상태변경이력
      where  변경일자 = :upd_dt)
where rnum = 1

Call        Count CPU Time Elapsed Time      Disk      Query    Current    Rows
------- --------- -------- ------------ --------- ---------- ---------- -------
Parse           1    0.000        0.000         0          0          0       0
Execute         1    0.000        0.000         0          0          0       0
Fetch           2    0.969        1.062        40       4536         42      10
------- --------- -------- ------------ --------- ---------- ---------- -------
Total           4    0.969        1.062        40       4536         42      10

Rows  Row Source Operation
----- -----------------------------------------------------------------------
    0 STATEMENT
   10  VIEW (cr=4536 pr=40 pw=40 time=1061996 us)
  111   WINDOW SORT PUSHED RANK (cr=4536 pr=40 pw=40 time=1061971 us)
498570    TABLE ACCESS FULL 상태변경이력 (cr=4536 pr=0 pw=0 time=1495760 us)
```

* physical read와 write가 각 40개 발생하며 훨씬 효율적