---
tags: [computer science, os]
---
# Storage Management
## Mass-Storage Structure
* Mass-Storage
    * non-volatile, secondary storage system of a computer
    * usually, HDD(Hard Disk Drive) or NVM(Non-Volatile Memory).
    * sometimes, magnetic tapes, optical disks, or cloud storage.
        * using the structure of RAID systems.

![회전하는 플래터의 트랙·섹터·실린더와 읽기 쓰기 헤드·암 구조](./img/1-generated.png){: w="760"}
*HDD moving-head disk mechanism*

* HDD Scheduling
    * to *minimize* the access time (or *seek time*)
    * to *maximize* data transfer *bandwidth*.
    
* **seek time**: the time for the device arm to move the heads to the cylinder containing the desired sector, and the rotational latency is the additional time for the platter to rotate the desired sector to the head.
* **disk bandwidth**: the total number of bytes transferred, divided by the total time between the first request and the completion of the last transfer.

### FIFO Scheduling
* Intrinsically fair, but generally does not provide the fastest services.
* Total head movement of 640 cylinders.

![헤드 53에서 요청 순서대로 이동하는 FCFS와 총 640 실린더 이동](./img/2-generated.png){: w="760"}
*FCFS disk scheduling*

### SCAN Scheduling
* The disk arm starts at one end of the disk and moves toward the other end, servicing requests as it reaches each cylinder, until it gets to the other end of the disk.
* At the other end, the *direction* of head movement is *reversed*, and continue.

* **SCAN Scheduling**: if the direction of head movement is moving towards 0.
* total head movement of 236 cylinders.

![헤드 53에서 0 방향으로 이동·반전하여 요청들을 처리하는 SCAN 예시](./img/3-generated.png){: w="760"}
*SCAN disk scheduling*

### C-SCAN (Circular-SCAN) Scheduling
* A variant of SCAN designed to provide a *more uniform wait time*.
* Moves the head from one end of the disk to the other, servicing requests along the way.
* However, when the head reaches the other end, *returns immediately* to the *beginning* of the disk *without servicing* any requests on the return trip.
* Treats the cylinders as a *circular list* that wraps around from the final cylinder to the first one.

* **C-SCAN Scheduling**
    * total head movement of 183 cylinders. (ignore from 199 to 0)

![상향 C-SCAN 순서와 199에서 0으로 무서비스 복귀하는 이동 비용](./img/4-generated.png){: w="760"}
*C-SCAN disk scheduling*

### Boot Block
* For a computer to start running, when it is powered up, it must have an initial program to run.
* A bootstrap loader is stored in NVM flash memory, and mapped to a known memory location.

![MBR의 부트 코드·파티션 테이블에서 부트 파티션 3을 선택하는 예시](./img/5-generated.png){: w="760"}
*Booting from a storage device in Windows*

### RAID
* **RAID** (Redundant Arrays of Independent Disks) is a collection of a variety of disk-organization techniques.
    * To improve the rate at which data can be read or written.
        * if the drives are operated **in parallel**.
    * To improve the **reliability** of data storage, because *redundant information* can be stored on multiple devices.
    * Thus, *failure* of one drive does not lead to *loss of data*.

* **Redundancy**: Improvement of *Reliability*
    * The *chance of fail* in a set of 𝑁 disks is much *greater* than the chance in a *single* disk.
    * Suppose that mean time between failures (MTBF) = 100,000 hours.
        * MTBF in an array of 100 disks = 100,000 / 100 = 1,000 hours.
    * The solution the problem of reliability: **redundancy**.
        * the simplest: *mirroring* (duplicate all the drives)
* **Parallelism**: Improvement in *Performance*
    * With multiple drives, we can improve the transfer rate by striping data across the drives.
    * **bit-level striping**: splitting the *bits* of each *byte*.
        * if we have 8 drives, we can write 𝑖 bit of each byte to drive 𝑖.
    * *block-level striping*: generalization to a number of drives.
* RAID Levels
    * *mirroring*: highly reliable, however, too expensive.
    * *striping*: highly efficient, however, not related to reliability.
    * How about **parity bit**?
        * set to 1: the number of bits in the byte is *even*.
        * set to 0: the number of bits in the byte is *odd*.
        * It enable us to detect an error if f one of the bits is damaged.
    * **RAID levels**: classify these schemes according to different *cost-performance trade-offs*.

![RAID 0·1·4·5·6과 다차원 RAID 6의 스트라이핑·복제·P/Q 중복 비교](./img/6-generated.png){: w="760"}
*RAID levels*

![RAID 0+1의 스트라이프 그룹 미러와 RAID 1+0의 미러 쌍 스트라이프를 단일 디스크 고장으로 비교](./img/7-generated.png){: w="760"}
*RAID 0 + 1 and 1 + 0 with a single disk failure*

## I/O System
* Two main jobs of a computer: I/O and computing
    * In many cases, the main job is I/O, for instance, web browsing, file editing, youtube, game, and so force.
    * The role of Operating System in I/O is to manage and control I/O operations and I/O devices.

![프로세서·캐시·메모리·PCIe 버스와 그래픽·SAS·확장 버스 장치 연결](./img/8-generated.png){: w="760"}
*A typical PC bus architecture*

* **Memory-Mapped I/O**
    * How does the processor give commands and data to a controller to accomplish an I/O transfer?
    * The controller has one or more registers for data and control signals.
        * data-in register: is read by the host to get input.
        * data-out register: is written by the host to send output.
        * status register: contains bits that can be read by the host.
        * control register: can be written by the host to start a command or to change the mode of a device.
    * If the device supports the memory-mapped I/O, control registers are mapped into the address space of the processor.
    * The CPU executes I/O requests using the standard data-transfer instructions to read and write the device-control registers at their mapped locations in physical memory.

![전통적 PC의 16진수 입출력 포트 주소 일부와 장치 대응 표](./img/9-generated.png){: w="760"}
*Device I/O port locations on PCs (partial)*

### Three types of I/O
* **Polling**: or **busy-waiting**: reading the status register repeatedly until the busy bit becomes clear.
* **Interrupt**: CPU has a wire called the interrupt-request line.
    * If CPU detects an interrupt, it jumps to an ISR(*interrupt service routine*) to handle an interrupt.
    * The addresses of ISRs is specified in the *interrupt vector table*.
 * **DMA** (Direct Memory Access): used to avoid programmed I/O (one byte at a time).
    * useful for handling large data transfer.

![장치 드라이버 시작부터 완료 신호·인터럽트 처리·CPU 재개까지의 입출력 주기](./img/10-generated.png){: w="760"}
*Interrupt-driven I/O cycle*

![기존 Pentium의 예외·인터럽트 벡터와 2번 NMI를 정리한 역사적 표](./img/11-generated.png){: w="760"}
*Intel Pentium processor event-vector table*

![드라이브 2의 c바이트를 주소 x 버퍼로 DMA 전송하고 완료 인터럽트를 보내는 과정](./img/12-generated.png){: w="760"}
*Steps in a DMA transfer*

### Blocking I/O vs Non-blocking I/O
* **Blocking** I/O: a thread is suspended.
    * moved from *running* queue to *waiting* queue.
* **Non-blocking** I/O: does not halt the execution of the thread.
    * e.g., receiving keyboard or mouse input in word processor.
    * returns as much as available.
* **Asynchronous system call**: the thread continues to execute its code.

* The diff between *non-blocking* and *asynchronous* system call
    * a non-blocking read() call
        * *returns immediately* with whatever data are available, the full number of bytes requested, fewer, or none at all.
    * An asynchronous read() call 
        * *requests a transfer* that will be performed in its entirety but will complete at some future time.

![동기 블로킹 I/O의 완료 대기와 비동기 I/O의 요청 수락·완료 통지 비교](./img/13-generated.png){: w="760"}
*Two I/O methods: (a) synchronous (b) asynchronous*

## File-System Interface
* **File System** provides the mechanism for on-line storage of and access to both *data* and *programs* of the operating system and all the users of the computer system.
* Consists of two distinct parts
    * a collection of *files*, each storing related data
    * a *directory* structure, which organizes all the files in the system.

* Access Methods
    * Sequential access: Information in the file is processed in order, one record after the other.
    * Direct access: relative access: A file is made up of fixed-length logical records that allow programs to read and write records rapidly in no particular order.

![현재 위치에서 읽고 쓰며 처음으로 되감는 순차 파일 접근](./img/14-generated.png){: w="760"}
*Sequential-access file*

![직접 접근으로 구현한 reset·read_next·write_next와 현재 위치 cp](./img/15-generated.png){: w="760"}
*Simulation of sequential access on a directed-access file*

* Directory Structure
    * The directory can be viewed as a symbol table that translates file names into theirs file control blocks.
    * The ways of organizing the directory structure:
        * Single-Level Directory
        * Two-Level Directory
        * Tree-Structured Directories
        * Acyclic-Graph Directories

![cat·bo·a·test·data·mail·cont·hex·records 파일이 하나의 디렉터리에 있는 구조](./img/16-generated.png){: w="760"}
*Single-level directory*

![사용자별 디렉터리에서 같은 이름을 별개 파일로 사용하는 2단계 디렉터리](./img/17-generated.png){: w="760"}
*Two-level directory*

![spell·bin·programs 아래 하위 폴더와 파일의 단일 부모 트리](./img/18-generated.png){: w="760"}
*Tree-structured directory structure*

![dict와 spell이 파일·하위 디렉터리를 공유하지만 순환은 없는 그래프](./img/19-generated.png){: w="760"}
*Acyclic-graph directory structure*

![avi와 book의 순환 및 jim과 공유 객체를 갖는 일반 디렉터리 그래프](./img/20-generated.png){: w="760"}
*General graph directory*

## File-System Implementation
* The file system itself is generally composed of many different levels.

![응용 프로그램부터 장치까지 이어지는 파일 시스템의 6계층](./img/21-generated.png){: w="760"}
*Layered file system*

* **Allocation Method** 
    * The main problem of implementing the file system: how to *allocate space to files* so that storage space is utilized *effectively* and files can be accessed *quickly*.
    * Three major methods in wise use:
        * *Contiguous Allocation*
        * *Linked Allocation*
        * **Indexed Allocation**

### Contiguous Allocation
* Requires that each file occupy a set of contiguous blocks on the device.

![시작 블록과 길이로 연속 구간을 지정하는 count·tr·mail·list·f의 할당](./img/22-generated.png){: w="760"}
*Contiguous allocation of disk space*

### Linked Allocation
* The problems of contiguous allocation
    * *external fragmentation*
    * *need for compaction*
* **Linked Allocation** solves all problems of contiguous allocation each file is a linked list of storage blocks the blocks may be scattered anywhere on the device.

![jeep 파일의 9→16→1→10→25 연결 할당과 시작·끝 항목](./img/23-generated.png){: w="760"}
*Linked allocation of disk space*

### FAT: File Allocation Table
* The disadvantages of the linked allocation
    * It can be used effectively only for sequential-access files.
    * To find i-th block of a file, we must start at the beginning of that file.
* **FAT**: an important variation on the linked allocation
    * simple but efficient method using a *file allocation table*.
* A section of storage at the beginning of each volume is set aside to contain the table. 
    * the table has one entry for each block and is indexed by block number.

![test의 시작 블록 217에서 FAT 618·339를 따라가는 중앙 포인터 표](./img/24-generated.png){: w="760"}
*File Allocation Table*

### Indexed Allocation
* The problems of linked allocation (without the FAT) the pointers to the blocks are scattered with blocks.
* Indexed Allocation solves this problem by bringing all the pointers together into the **index block**.
* Each file has its own index block, which is an array of storage-block addresses.
    * the i-th entry in the index block points to the i-th block of the file.

![jeep의 인덱스 블록 19가 데이터 블록 9·16·1·10·25를 가리키는 할당](./img/25-generated.png){: w="760"}
*Indexed allocation of disk space*

### Free-Space Management
* To keep track of free disk space, the system maintains a *free-space list*.

![빈 블록 2부터 27까지 연결된 free-space list와 종료 표시](./img/26-generated.png){: w="760"}
*Linked free-space list on disk*
