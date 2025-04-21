---
tags: [programming language, java]
---

# Lambda Expression
## 람다식이란
* **익명 함수(Anonymous function)**을 생성하기 위한 식
  * 객체 지향 언어보다는 함수 지향 언어에 가까움
* 잘 사용하면 코드가 간결해지고, 컬렉션의 요소를 필터링하거나 매핑하기 쉽다
* 매개 변수를 가진 코드 블록의 형태
  * **런타임 시에 익명 구현 객체를 생성**
  * 어떤 인터페이스를 구현할지는 대입되는 인터페이스가 무엇이냐에 따라 결정

```java
Runnable runnable = new Runnable() {
  public void run() {...};
};

// same
Runnable runnable = () -> {...};
```  

## 기본 문법
```java
// 매개변수명은 자유롭게 줄 수 있다
(int a) -> {System.out.println(a)};

// 타입은 런타임 시 대입되는 값에 따라 자동 인식될 수 있다
// 따라서 매개 변수 타입은 일반적으로 생략된다
(a) -> {System.out.println(a)};

// 하나의 매개변수만 있다면 ()를 생략할 수 있다
// 하나의 실행문만 있다면 {}를 생략할 수 있다
a -> System.out.println(a);

// 리턴문이 있다면, 아래와 같이 쓸 수 있다
(x, y) -> {return x + y};

// 실행문에 return문만 있는 경우, return을 생략하고 아래와 같이 작성할 수 있다
(x, y) -> x + y;
```

## 타겟 타입과 함수형 인터페이스
* 람다식은 단순 메소드를 선언하는 것이 아닌, **메소드를 가지고 있는 객체**를 생성
* 람다식은 인터페이스의 익명 구현 객체를 생성
* 람다식이 대입될 인터페이스를 람다식의 타겟 타입(target type)이라고 함

### @FuntionalInterface
* 인터페이스가 람다식을 이용해 구현 객체를 생성하려면 **하나의 추상 메소드만**을 정의해야 함
  * 이 조건을 만족하는 인터페이스를 함수형 인터페이스라고 함 

```java
// 두 개 이상의 추상 메소드가 선언되면 컴파일 오류 발생 시키는 어노테이션
@FunctionalInterface
public interface Example {
  public void method1();
  public void method2(); // complie error
}
```

### 매개 변수와 리턴값이 없는 람다식
```java
@FunctionalInterface
public interface Example {
  public void method();
}

public class Main {
  public static void main(String[] args) {
    Example e;
    
    e = () -> {
      String str = "1";
      System.out.println(str);
    };
    e.method();

    e = () -> { System.out.println("2")};
    e.method();

    e = () -> System.out.println("3");
    e.method();
  }
}
```

### 매개 변수가 있는 람다식
```java
@FunctionalInterface
public interface Example {
  public void method(int x);
}

public class Main {
  public static void main(String[] args) {
    Example e;
    
    e = (x) -> {
      int result = x * 5;
      System.out.println(result);
    };
    e.method(1);

    e = (x) -> { System.out.println(x * 5)};
    e.method(2);

    e = x -> System.out.println(x * 5);
    e.method(3);
  }
}
```

### 리턴 값이 있는 람다식
```java
@FunctionalInterface
public interface Example {
  public int method(int x, int y);
}

public class Main {
  public static void main(String[] args) {
    Example e;
    
    e = (x, y) -> {
      int result = x * y;
      return result;
    };
    System.out.println(e.method(1, 2));

    e = (x, y) -> { return x * y};
    System.out.println(e.method(1, 2));

    e = (x, y) -> x * y;
    System.out.println(e.method(1, 2));

    e = (x, y) -> multiply(x, y);
    System.out.println(e.method(1, 2));
  }

  public static int multiply(int x, int y) {
    return x * y;
  }
}
```

```java
@FunctionalInterface
public interface Example {
  public int method(int x, int y);
}

public class Main {
  public static void main(String[] args) {
    Example e;
    
    e = (x, y) -> {
      int result = x * y;
      return result;
    };
    System.out.println(e.method(1, 2));

    e = (x) -> { return x * y};
    System.out.println(e.method(1, 2));

    e = x -> x * y;
    System.out.println(e.method(1, 2));
  }
}
```

## 클래스 멤버와 로컬 변수 사용
### 클래스의 멤버 사용
* 클래스의 필드와 메소드를 제약없이 사용할 수 있다
* **다만, 람다식에서의 this는 내부적으로 생성되는 익명 객체의 참조가 아니라 람다식을 실행한 객체의 참조**

```java
@FunctionalInterface
public interface FInterface {
  public void method();
}

public class ThisExample{
  public int outterField = 10;

  class Inner {
    int innerField = 20;

    void foo() {
      FInterfce test = () -> {
        System.out.println("outterField: " + outterField);
        System.out.println("outterField: " + ThisExample.this.outterField); // 바깥 객체 참조

        System.out.println("outterField: " + innerField);
        System.out.println("outterField: " + this.innerField); // 람다식 내부에서 this는 inner 객체 참조
      };
      test.method();
    }
  }
}

public class Main {
  public static void main(String[] args) {
    ThisExample example = new ThisExample();
    ThisExample.Inner inner = example.new Inner();
    inner.foo();
  }
}
```

### 로컬 변수 사용
* 람다식에서 바깥 클래스의 필드나 메소드는 제한 없이 사용할 수 있으나, 메소드의 매개 변수 또는 로컬 변수를 사용하면 이 두 변수는 final 특성을 가져야 한다
  * 매개 변수 또는 로컬 변수를 람다식에서 읽는 것은 허용되지만, 람다식 내부 또는 외부에서 변경 불가

```java
@FunctionalInterface
public interface FInterface {
  public void method();
}

public class VariableExample{
  void foo(int arg) {
    int localVar = 40;

    // arg = 31; // final 특성 때문에 수정 불가
    // localVar = 41; // final 특성 때문에 수정 불가

    FInterface test = () -> {
      System.out.println("arg: " + arg);
      System.out.println("localVar: " + localVar);
    };
    test.method();
  }
}

public class Main {
  public static void main(String[] args) {
    VariableExample vExample = new VariableExample();
    vExample.method(20);
  }
}
```

## See Also
[Oracle Java Tutorial](https://docs.oracle.com/javase/tutorial/java/javaOO/lambdaexpressions.html)

