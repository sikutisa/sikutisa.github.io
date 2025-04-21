---
tags: [programming language, c#, .NET]
---

# ConfigureAwait
## ConfigureAwait??
* C#에서 `Task` 또는 `Task<T>` 객체에서 호출할 수 있는 메소드
    * 대상 `Task`에 대해 `await`이 수행되는 방식을 정의할 때 사용
    * `continueOnCapturedContext`라는 `boolean`타입의 파라미터가 있음
        * true: `await`이후 작업은 원래 작업이 실행된 컨텍스트(context)에서 계속 실행
        * false: 동일 컨텍스트를 유지하지 않고 `await`이후 작업이 다른 스레드에서 실행될 수 있음

```cs
// ConfigureAwait(true)가 디폴트
await SomethingAsync();
await SomethingAsync().ConfigureAwait(true);

// 따라서 아래처럼 false를 주냐 마느냐가 관건
await SomethingAsync().ConfigureAwait(false);
```

### Context??
* 실행 중인 스레드와 연관된 상태, 환경 등을 나타내는 추상화
    * 스레드가 어떤 작업을 수행할 때의 환경을 의미하며, 이 환경에는 스레드의 상태나 설정 등이 포함됨
* 예시
    * UI 애플리케이션: 이 때의 컨텍스트는 주로 UI thread 및 이벤트 루프가 됨
    * ASP .NET: 이 때 컨텍스트는 주로 HTTP 요청과 해당 요청 처리와 관련된 상태가 됨

## 중요한 이유
* `await`이 여러 상황과 컨텍스트에서 어떻게 동작할지를 제어해 성능이나 정확성등을 최적화하는 데 활용된다

### true의 경우
* 디폴트 동작 방식
* `await`는 작업이 시작될 때 현재 컨텍스트를 캡처하고, 작업이 완료되면 캡처된 컨텍스트에서 후속 작업을 이어서 실행해 나간다.
    * 연속된 작업이 동일한 상태 또는 리소스에 접근할 수 있도록 보장해줌
* 문제점
    * 데드락: 만약 캡처된 컨텍스트가, 작업 완료에 의존하는 다른 동작에 의해 block된다면 데드락이 발생할 수 있음
        * UI 스레드가 UI 스레드에서 다시 실행돼야 하는 작업을 동기적으로 기다리는 경우
    * 성능: 캡처된 컨텍스트가 UI 스레드거나 스레드 풀의 스레드인 경우, 캡처된 컨텍스트에서 작업을 재실행 하는 것은 컨텍스트 스위칭을 유발할 수 있음
        * UI 스레드가 다른 이벤트를 처리하느라 바쁜 상황이라면, 처리가 끝날 때 까지 대기해야 함
    * 확장성: 캡처된 컨텍스트가 처리할 수 있는 작업량에 제한이 있는 경우, 너무 많은 작업이 해당 컨텍스트에서 재개되면 리소스 고갈로 응답성이 저하될 수 있음
        * ASP.NET에서 요청을 처리할 수 있는 스레드 수가 고정되어 있다면, 너무 많은 연속 작업을 해당 스레드에서 재개하면 처리량이 줄어들고 지연 시간이 증가할 수 있음

### false의 경우
* await가 현재 컨텍스트를 캡처하거나 동일한 컨텍스트에서 재개하지 않도록 하고, 대신 사용 가능한 임의의 스레드에서 재개하도록 지시
* 특정 상황에서 성능 향상, 확장성, 데드락 회피와 같은 이점을 취할 수 있음
* 문제점
    * 연속된 작업에서 원래 컨텍스트와 그 상태에 접근할 수 없게 되므로, 컨텍스트에 의존하는 리소스나 코드가 있을 경우 문제가 발생할 수 있음

## 어떻게 사용하는 것이 좋을까
### true의 경우
* 연속된 작업에서 오리지널 컨텍스트 또는 상태에 접근할 필요가 있을 때
    * 예를 들어, `await`이후 UI를 업데이트하거나 UI에 의존적인 리소스에 엑세스할 필요가 있을 때

### false의 경우
* 연속 작업에서 오리지널 컨텍스트 또는 상태에 접근할 필요가 없을 때
    * 예를 들어, 특정 컨텍스트에 의존적이지 않은 CPU 또는 I/O 작업

### 주의 사항
* 라이브러리나 재사용 가능한 컴포넌트를 개발하는 경우
    * UI 또는 비-UI 애플리케이션에서 모두 사용할 수 있는 라이브러리나 컴포넌트를 작성할 때는 특별한 이유가 없는 한 ConfigureAwait(false)를 사용
    * 사용자의 컨텍스트나 코드 사용 방식에 대한 불필요한 제약이나 가정을 하지 않고 코드를 작성할 수 있음

* ASP.NET 애플리케이션의 경우(또는 synchronization context을 사용하는 애플리케이션)
    * ConfigureAwait(false)를 사용에 유의
    * 연속 작업에서 HttpContext.Current나 다른 요청별 상태에 접근하는 기능이 의도대로 동작하지 않을 수 있음
    * 컨트롤러나 핸들러에서 동기 코드와 비동기 코드를 혼합해 사용할 경우 ConfigureAwait(false)를 사용하더라도 교착 상태를 유발할 수 있음

* 비동기 코드의 단위 테스트를 작성하는 경우
    * 특별한 이유가 없는 한 ConfigureAwait(false)를 사용하지 않음
    * 테스트가 실제 실행 환경에서 의도한 컨텍스트와 동일한 방식으로 실행되도록 보장할 수 있고, ConfigureAwait(false)를 사용하면 특정 컨텍스트에서만 발생하는 잠재적인 문제나 버그를 발견하지 못할 수 있음

## See Also
* [Task.ConfigureAwait Method Doc](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.configureawait?view=net-8.0)
* [Async and Await](https://blog.stephencleary.com/2012/02/async-and-await.html#avoiding-context)
* [.NET: Don’t use ConfigureAwait(false)](https://www.gabescode.com/dotnet/2022/02/04/dont-use-configureawait.html)
