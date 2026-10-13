---
tags: [computer science, oop, design pattern]
---

# Facade Pattern
## Overview
* Purpose
    * Supplies a single interface to a set of interfaces within a system.
* Use When
    * A simple interface is needed to provide access to a complex system.
    * There are many dependencies between system implementations and clients.
    * Systems and subsystems should be layered.

## The Facade Pattern
*  Provides a unified interface to a set of interfaces in a subsystem. 
    * It defines a higher-level interface that makes a subsystem easier to use.

![파사드 도입 전후 클라이언트와 하위 시스템의 의존 관계 비교](./img/1-generated.png){: w="760"}


## Motivation
* In typical OO Design,
    * Structuring a system into subsystems helps reduce complexity.
    * Subsystems are groups of classes, or groups of classes and other subsystems.
    * May produces many minimal classes.
* Problems
    * Class/Subsystem interface can become quite complex.
        * Too many options to use!
    * A new-comer cannot figure out where to begin.
* Solution
    * Facade object provides a single, simplified interface to the more general facilities of a subsystem.

## Benefits
* Hides the implementation of the subsystem from clients.
    * makes the subsystem easier to use.
* Promotes weak coupling between the subsystem and its clients.
    * allows changing the classes comprising the subsystem without affecting the clients.
* **Does not prevent sophisticated clients from accessing the underlying classes**.
* Notice: **Facade does not add any functionality**, it just **simplifies interfaces**.


## Example
![Application이 Db 파사드와 ProductData를 사용하고 Db가 System.Data 세부 객체를 조율하는 구조](./img/2-generated.png){: w="760"}

![Compiler 파사드가 Scanner·Parser·ProgramNodeBuilder·CodeGenerator를 조율하는 컴파일 과정](./img/3-generated.png){: w="760"}

### Example Code
```java
class Scanner {...};
class Parser {...};

...

class CodeGenerator {...};
class Compiler { //facade class
    public:
        Compiler();
        virtual void Compile(istream&, BytecodeStream&); 
};

void Compiler::Compile(istream& input, BytecodeStream& output) {
    Scanner scanner(input);
    ProgramNodeBuilder builder;

    Parser parser;
    parser.Parse(scanner, builder);
    
    RISCCodeGenerator generator(output);
    ProgramNode* parseTree = builder.GetRootNode();
    parseTree->Traverse(generator);
}
```

### Facade Example
![두 클라이언트의 doSomething 호출을 파사드가 세 패키지의 클래스 작업으로 조율하는 예시](./img/4-generated.png){: w="760"}

### Known Uses: Web Applications
![Browser·Web Server·Application Server 내부 Facade·하위 시스템·Database Server의 호출 경로](./img/5-generated.png){: w="760"}

### Facade in Layered Architecture
![체스 UI와 Chess Logic 사이의 Facade, XML·GTK·Linux·Hardware로 이어지는 계층 구조](./img/6-generated.png){: w="760"}

## Comparing the Facade with the Adapter Pattern
* Are there existing classes?
* Is there an interface we must design to?
* Is a simpler interface needed?

## The Principle of Least Knowledge (Law of Demeter)
* When you design a system, you should be careful of the number of classes it interacts with and also how it comes to interact with those classes.
* A method m of an object o may only invoke the methods of the following kinds of objects.
    * o itself
    * m's parameters
    * any objects created/instantiated within m
    * o's direct component objects
    * a global variable, accessible by o, in the scope of m
* i.e., "use only one dot"
    * a.b.Method() breaks the law where a.Method() does not

### Example
```java
public float WorseExample() {
    Thermometer thermometer = station.GetThermometer();
    return thermometer.GetTemperature();
}

public float BetterExample() {
    return station.GetTemperature();
}
```

![Host가 Station을 통해 Thermometer까지 탐색하는 호출과 Station.GetTemperature로 위임하는 호출 비교](./img/7-generated.png){: w="760"}

```java
public class Car {
    Engine engine;
    public Car() { 
        // initialize car
    }

    public void start(Key key) {
        Doors doors = new Doors();
        boolean authorized = key.turns();

        if (authorized) {
            engine.start();
            updateDashboardDisplay();
        }
    }

    public void updateDashBoardDisplay() {
        //
    }
}
```

## Review
* Provides a unified interface to a set of interfaces in a subsystem. 
* Facade defines a higher-level interface that makes the subsystem easier to use.

### Related Patterns
* Mediator
    * Mediator’s colleagues are aware of Mediator.
* Facade
    * Unidirectional rather than cooperative interactions between object and subsystem.
    * The subsystem doesn’t know about the Facade.
    * Facade doesn’t add functionality, Mediator does.
