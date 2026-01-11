---
tags: [database]
---

# SQL 옵티마이저
## 통계정보와 비용 계산 원리
### 선택도와 카디널리티
* 선택도(Selectivity)
    * 전체 레코드 중 조건절에 의해 선택되는 레코드 비율
    * '=' 조건으로 검색하면, 아래와 같이 계산

    선택도 = 1 / NDV(Number of Distinct Values, 컬럼 값 종류 개수)

* 카디널리티(Cardinality)
    * 전체 레코드 중에서 조건절에 의해 선택되는 레코드 개수

    카디널리티 = 총 로우 수 x 선택도 = 총 로우 수 / NDV

* 옵티마이저는 카디널리티를 구하고, 그만큼의 데이터를 엑세스하는 데 드는 비용을 계산해 테이블 엑세스 방식, 조인 순서, 조인 방식 등을 결정
    * 선택도를 잘못 계산하면, 카디널리티와 비용도 잘못 계산함
    * 선택도 게산에 NDV를 사용하므로, 통계정보 수집주기나 샘플링 비율 등을 잘 결정해 통계정보 수집 과정에서 이 값을 정확히 구하는 것이 중요

### 통계정보
* 오브젝트 통계
    * 테이블 통계
        * 주요 통계항목

        | 통계항목 | 설명 |
        | --- | --- |
        | NUM_ROWS | 테이블에 저장된 총 레코드 개수 |
        | BLOCKS | 테이블 블록 수. '사용된' 익스텐트(데이터가 한 건이라도 입력된 적이 있는 모든 익스텐트)에 속한 총 블록 수 |
        | AVG_ROW_LEN | 레코드당 평균 길이(Byte) |
        | SAMPLE_SIZE | 샘플링한 레코드 수 |
        | LAST_ANALYZED | 통계정보 수집일시 | 

    ```sql
    -- 통계 수집
    BEGIN
        DBMS_STATS.GATHER_TABLE_STATS('SCOTT', 'EMP');
    END;

    -- 통계 확인
    SELECT *
    FROM ALL_TABLES
    WHERE OWNER = 'SCOTT'
    AND TABLE_NAME = 'EMP';
    ```

    * 인덱스 통계
        * 주요 통계항목

        | 통계항목 | 설명 | 용도 |
        | --- | --- | --- |
        | BLEVEL | 브랜치 레벨. 인덱스 루트에서 리프 블록에 도달하기 직전까지 읽게 되는 블록 수 | 인덱스 수직적 탐색 비용 계산 |
        | LEAF_BLOCKS | 인덱스 리프 블록 총 개수 | 인덱스 수평적 탐색 비용 계산 |
        | NUM_ROWS | 인덱스에 저장된 레코드 개수 | | 
        | DISTINCT_KEYS | 인덱스 키값의 조합으로 만들어지는 값의 종류 개수. 인덱스 키값을 모두 '=' 조건으로 조회할 때 선택도 계산에 사용 | |
        | AVG_LEAF_BLOCKS_PER_KEY | 인덱스 키값을 모두 '=' 조건으로 조회할 때 읽게 될 리프 블록 개수 | |
        | AVG_DATA_BLOCKS_PER_KEY | 인덱스 키값을 모두 '=' 조건으로 조회할 때 읽게 될 테이블 블록 개수 | 테이블 엑세스 비용 계산 |
        | CLUSTERING_FACTOR | 인덱스 키값 기준으로 테이블 데이터가 모여 있는 정도. 인덱스 전체 레코드를 스캔하면서 테이블 레코드를 찾아갈 때 읽게 될 테이블 블록 개수를 미리 계산해 놓은 수치 | |

    ```sql
    -- 인덱스 통계만 수집
    BEGIN
        DBMS_STATS.GATHER_INDEX_STATS(ownname => 'SCOTT', indname => 'EMP_X01');
    END;

    -- 테이블 통계를 수집하면서 인덱스 통계도 같이 수집
    BEGIN
        DBMS_STATS.GATHER_TABLE_STATS('SCOTT', 'EMP', cascade => true);
    END;

    -- 통계 확인
    SELECT *
    FROM ALL_INDEXES
    WHERE OWNER = 'SCOTT'
    AND TABLE_NAME = 'EMP'
    AND INDEX_NAME = 'EMP_X01';
    ```
    
    * 컬럼 통계
        * 주요 통계항목

        | 통계항목 | 설명 |
        | --- | --- |
        | NUM_DISTINCT | 컬럼 값의 종류 개수 |
        | DENSITY | '=' 조건으로 검색할 때의 선택도를 미리 구해 놓은 값. 히스토그램이 없거나 100% 균일한 분포를 갖는다면 1 / NUM_DISTINCT 값과 일치 |
        | AVG_COL_LEN | 컬럼 평균 길이(Bytes) |
        | LOW_VALUE | 최소 값 |
        | HIGH_VALUE | 최대 값 |
        | NUM_NULLS | 값이 NULL인 레코드 수 |

        ```sql
        -- 컬럼 통계는 테이블 통계 수집할 때 함께 수집됨
        -- 통계 확인
        SELECT *
        FROM ALL_TAB_COLUMNS
        WHERE OWNER = 'SCOTT'
        AND TABLE_NAME = 'EMP'
        AND COLUMN_NAME = 'DEPTNO';
        ```

    * 컬럼 히스토그램
        * 데이터 분포가 균일하지 않은 컬럼의 경우, 선택도가 DENSITY 또는 1 / NUM_DISTINCT 값과 잘 맞지 않음
        * 선택도를 잘못 구하면 데이터 엑세스 비용을 잘못 산정하게 되므로, 옵티마이저는 일반적인 컬럼 통계 외에 히스토그램을 추가로 활용
        * 히스토그램은 컬럼 값별로 데이터 비중 또는 빈도를 미리 계산해 놓은 통게정보
            * 실제 데이터를 읽어서 계산
        
        * 히스토그램 유형
            | 히스토그램 유형 | 설명 |
            | --- | --- |
            | FREQUENCY(도수분포) | 값별로 빈도수 저장 |
            | HEIGHT-BALANCED(높이균형) | 각 버킷의 높이가 동일하도록 데이터 분포 관리 | 
            | TOP-FREQUENCY(상위도수분포) | 많은 레코드를 가진 상위 n개의 값에 대한 빈도수 저장 |
            | HYBRID(하이브리드) | 도수분포와 높이균형 히스토그램의 특성 결합 |


        ```sql
        -- 테이블 통계 수집 시, method_opt 파라미터를 지정해 히스토그램 수집
        BEGIN
            DBMS_STATS.GATHER_TABLE_STATS('SCOTT', 'EMP', cascade => false, method_opt=>'for columns ename size 10, deptno size 4');
        END;

        -- 히스토그램 확인
        SELECT *
        FROM ALL_HISTORGRAM
        WHERE OWNER = 'SCOTT'
        AND TABLE_NAME = 'EMP'
        AND COLUMN_NAME = 'DEPTNO'
        ORDER BY ENDPOINT_VALUE;
        ```

    * 시스템 통계
        * 애플리케이션 또는 하드웨어 성능 특성 측정
            * CPU속도, 평균적인 Single Block I/O 속도, 평균적인 Multi Block I/O 속도, 평균적인 MultiBlock I/O 개수, I/O 서브시스템의 최대 처리량, 병렬 Slave의 평균적인 처리량 등
        
        ```sql
        SELECT SNAME, PNAME, PVAL1, PVAL2
        FROM SYS.AUX_STATS$;
        ```

### 비용 계산 원리
* 예시로 단일 테이블을 인덱스로 엑세스할 때의 비용 계산 원리를 살펴보자
    * 인덱스 키값을 모두 '=' 조건으로 검색할 때

        ```
        비용 = BLEVEL + AVG_LEAF_BLOCKS_PER_KEY + AVG_DATA_BLOCKS_PER_KEY
            = 인덱스 수직적 탐색 비용 + 인덱스 수평적 탐색 비용 + 테이블 랜덤 엑세스 비용
        ```

    * 인덱스 키값이 모두 '=' 조거닝 아닐 때

        ```
        비용 = BLEVEL + LEAF_BLOCKS x 유효 인덱스 선택도 + CLUSTERING_FACTOR x 유효 테이블 선택도
            = 인덱스 수직적 탐색 비용 + 인덱스 수평적 탐색 비용 + 테이블 랜덤 엑세스 비용
        ```

    * BLEVEL, LEAF_BLOCK, CLUSTERING_FACTOR는 인덱스 통계에서, 유효 인덱스 및 테이블 선택도는 컬럼 통계 및 히스토그램으로 게산
        * 유효 인덱스 선택도 = 전체 인덱스 레코드 중 엑세스 조건에 의해 선택될 것으로 예상되는 레코드 비중
        * 유효 테이블 선택도 = 전체 인덱스 레코드 중 인덱스 컬럼에 대한 모든 조건절에 의해 선택될 것으로 예상되는 레코드 비중
* 비용의 정확한 의미
    * 위 계산은 'I/O 비용 모델' 기준
        * 이때 Cost는 '예상 I/O Call 횟수'를 의미
    * 최신 'CPU 비용 모델'에서 Cost는 Single Block I/O을 기준으로 한 상대적 시간 표현
        * Cost 100은 '이 시스템에서 Single Block I/O를 100번 정도 하는 시간'이란 의미
    * 같은 실행계획으로 같은 양의 데이터를 읽어도 애플리케이션 및 하드웨어 성능에 따라 절대 소요시간이 달라질 수 있기 때문에 CPU 비용 모델이 개발됨

## 옵티마이저에 대한 이해
### 옵티마이저 종류
* 비용기반(Cost-Based) 옵티마이저는 사용자 쿼리를 위해 후보군이 될만한 실행계획을 도출하고, 데이터 딕셔너리(Data Dictionary)에 미리 수집해 둔 통계정보를 이용해 각 실행계획의 예상비용을 산정하고, 그중 가장 낮은 비용의 실행계획 하나를 선택하는 옵티마이저
    * 데이터량, 컬럼 값의 수, 컬럼 값 분포, 인덱스 높이, 클러스터링 팩터 등을 활용
* 규칙기반(Rule-Based) 옵티마이저는 각 엑세스 경로에 대한 우선순위 규칙에 따라 실행계획을 만듦
    * 통게정보를 활용하지 않고 단순 규칙에 의존해 대량 데이터 처리에 부적합
    * 규칙 정보

    | 순위 | 엑세스 경로 |
    | --- | --- |
    | 1 | Single Row by Rowid |
    | 2 | Single Row by Cluster Join |
    | 3 | Single Row by Hash Cluster Key with Unique or Primary Key |
    | 4 | Single Row by Unique or Primary Key | 
    | 5 | Clustered Join |
    | 6 | Hash Cluster Join |
    | 7 | Indexed Cluster Key |
    | 8 | Composite Index |
    | 9 | Single-Column Indexes |
    | 10 | Bounded Range Search on Indexed Columns |
    | 11 | Unbounded Range Search on Indexed Columns |
    | 12 | Sort Merge Join |
    | 13 | MAX or MIN of Indexed Column |
    | 14 | ORDER BY on Indexed Column |
    | 15 | Full Table Scan |

* RBO가 비효율적인 경우 예시

```sql
-- 고객유형코드에 인덱스가 있으면 무조건 인덱스 사용
-- 하지만, 해당 조건에 대한 선택도가 90%라면 좋은 선택이 아님
SELECT *
FROM 고객
WHERE 고객유형코드 = 'CC0123';

-- ORDER BY가 Full Scan보다 우선순위가 높아 무조건 인덱스 사용
-- 부분범위 처리가 가능한 상황에서 인덱스로 소트 연산을 생략한다면 성능에 이점
-- 인덱스로 전체 레코드를 엑세스하는 것은 좋지 않음
SELECT *
FROM 고객
ORDER BY 고객명;

-- BETWEEN이 부등호보다 우선순위가 높아 연봉 컬럼 인덱스를 사용
-- 하지만 60세 이상 사원보다 3000 ~ 9000 수준의 연봉을 받는 사원이 더 많음
SELECT *
FROM 사원
WHERE 연령 >= 60
AND 연봉 BETWEEN 3000 AND 9000;
```

### 옵티마이저 모드
* 최적화 목표를 설정하는 기능으로서, 아래 세가지 옵티마이저 모드 중 하나를 선택할 수 있음
    * ALL_ROWS: 전체 처리속도 최적화
        * 쿼리 결과집합 '전체를 읽는 것을 전제로' 시스템 리소스를 가장 적게 사용하는 실행계획 선택
        * 전체 처리속도 최적화
    * FIRST_ROWS: 최초 응답속도 최적화
        * 전체 결과집합 중 '앞쪽 일부만 읽다가 멈추는 것을 전제로' 응답 속도가 가장 빠른 실행계획 선택
        * 최초 응답속도 최적화가 목표
        * ALL_ROWS와 비교하면, Table Full Scan보다 인덱스를 더 많이 선택하고, 해시 조인, 소트 머지 조인보다 NL 조인을 더 많이 선택하는 경향
        * **Deprecated**
    * FIRST_ROWS_N: 최초 N건 응답속도 최적화
        * 사용자가 '앞쪽 N개 로우만 읽고 멈추는 것을 전제로' 응답 속도가 가장 빠른 실행계획 선택
        * FIRST_ROWS는 사용자가 데이터를 어느 정도 읽고 멈출지 지정하지 않아 정확한 비용 산정이 어려운 반면에 FIRST_ROWS_N은 읽을 데이터 건수를 지정하였으므로 더 정확한 비용 산정 가능

        ```sql
        ALTER SESSION SET OPTIMIZEZR_MODE = FIRST_RWOS_1; -- 1, 10, 100, 1000 이 가능
        SELECT /*+ FIRST_ROWS(30) */ * FROM T WHERE ... -- 힌트로 설정할 때는 0보다 큰 정수값으로 설정 가능
        ```

### 옵티마이저에 영향을 미치는 요소
* SQL과 연산자 형태
    * 같은 결과이더라도 SQL 작성 형태와 사용한 연산자(IN, LIKE, 부등호 등)에 따라 옵티마이저 선택에 영향
* 인덱스, IOT, 클러스터, 파티션, MV 등 옵티마이징 팩터
    * 같은 쿼리라도 옵티마이징 팩터 구성 여부와 방식에 따라 성능이 달라짐
* 제약 설정
    * PK, FK, Not Null과 같은 제약(Constraint)는 데이터 무결성 뿐만 아니라 옵티마이저 성능 최적화에도 중요한 메타 정보
* 통계정보
    * 매우 강력한 요소로, 아래와 같은 경우 성능에 악영향 또는 장애 원인이 될 수 있음
        * 통계정보 삭제, 대량 데이터 삭제 후 통계정보 수집, 통계정보 없던 테이블에 인덱스 생성 등
* 옵티마이저 힌트
    * 옵티마이저는 힌트를 명령어(directives)로 인식하고 그대로 따르므로 가장 절대적인 영향을 미치는 요소 
* 옵티마이저 관련 파라미터

### 옵티마이저의 한계
* DBMS에 따라, 버전에 따라 옵티마이저가 다른 실행계획을 생성할 수 있음
* 통계정보를 '필요한 만큼 충분히' 확보하는 것부터 수집 및 관리 비용때문에 불가능
* 바인드 변수를 사용한 SQL에 컬럼 히스토그램을 활용할 수 없음
* 기본적으로 비용기반이나, 내부적으로 여러 가정과 정해진 규칙을 통ㅎ애 기계적인 선택을 하게 됨

### 개발자의 역할
* 스스로 옵티마이저가 돼야 한다
    * 옵티마이저의 실행계획을 점검하고, 개선할 여지를 찾자
* 필요한 최소 블록만 읽도록 쿼리 작성
    * 작성자 스스로 결과집합을 논리적으로 잘 정의하고, 그 결과집합을 만들기 위해 DB 프로세스가 최소한의 일만 하도록 쿼리를 효율적으로 작성
    * DB 성능은 I/O 효율에 달려있으므로 동일한 레코드를 반복적으로 읽지 않고, 필요한 최소 블록만 읽도록 구현
* 최적의 옵티마이징 팩터 제공
    * 옵티마이저가 필요하다고 판단하는 인덱스, 파티션, 클러스터 등을 실시간으로 만들면서 SQL을 최적화할 수는 없음
    * 전략적인 인덱스 구성
        * 어떤 테이블을 어떤 조건으로 자주 엑세스하는지 
    * DBMS가 제공하는 다양한 기능 활용
        * 파티션, 클러스터, IOT, Result Cache 등 DBMS가 제공하는 기능 적극 활용
    * 옵티마이저 모드 설정
    * 정확하고 안정적인 통계정보
* 필요하다면, 옵티마이저 힌트를 사용해 최적의 엑세스 경로로 유도