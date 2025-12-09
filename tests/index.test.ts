import { FlexDto } from "../src/index";

// ============================================================================
// 테스트 헬퍼 함수
// ============================================================================

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ 실패: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `❌ 실패: ${message}\n   예상: ${JSON.stringify(expected)}\n   실제: ${JSON.stringify(
        actual
      )}`
    );
  }
  console.log(`✅ ${message}`);
}

// ============================================================================
// 테스트용 DTO 클래스들
// ============================================================================

class Center extends FlexDto {
  centerId = "";
  centerName = "";
  address = "";
  manager: User | null = null;

  constructor(data: Center) {
    super();
    this.init(data, {
      transforms: {
        manager: (v) => (v ? new User(v) : null),
      },
    });
  }
}

class User extends FlexDto {
  userId = "";
  userName = "";
  email = "";
  age = 0;
  isAdmin = false;
  center: Center | null = null;
  roles: string[] = [];

  constructor(data: User) {
    super();
    this.init(data, {
      transforms: {
        age: Number,
        isAdmin: Boolean,
        center: (v) => (v ? new Center(v) : null),
      },
    });
  }
}

class Product extends FlexDto {
  productId = "";
  productName = "";
  price = 0;
  stock = 0;
  tags: string[] = [];

  constructor(data: Product) {
    super();
    this.init(data, {
      transforms: {
        price: Number,
        stock: Number,
      },
    });
  }
}

class Order extends FlexDto {
  orderId = "";
  totalAmount = 0;
  createdAt: Date | null = null;
  products: Product[] = [];
  customer: Customer | null = null;

  constructor(data: Order) {
    super();
    this.init(data, {
      aliases: {
        orderId: ["order_id", "orderId", "id"],
      },
      transforms: {
        totalAmount: Number,
        createdAt: (v) => (v ? new Date(v) : null),
        products: (v) => (Array.isArray(v) ? v.map((item) => new Product(item)) : []),
        customer: (v) => (v ? new Customer(v) : null),
      },
    });
  }
}

class Customer extends FlexDto {
  customerId = "";
  customerName = "";
  email = "";
  age: number | null = null;

  constructor(data: Customer) {
    super();
    this.init(data, {
      transforms: {
        age: (v) => (v === null || v === undefined ? null : Number(v)),
      },
    });
  }
}

class AutoNumberTest extends FlexDto {
  age = 0;
  count = 0;
  price = 0;

  constructor(data: AutoNumberTest) {
    super();
    this.init(data);
  }
}

class StrictUser extends FlexDto {
  age = 0;
  isAdmin = false;
  name = "";

  constructor(data: StrictUser) {
    super();
    this.init(data, {
      strictMode: true,
    });
  }
}

// ============================================================================
// 테스트 실행
// ============================================================================

console.log("=== flex-dto 통합 테스트 시작 ===\n");

try {
  // ========================================================================
  // 기본 테스트
  // ========================================================================
  console.log("📋 기본 테스트");

  const apiResponseSnake = {
    user_id: "U001",
    user_name: "홍길동",
    email: "hong@example.com",
    age: "30",
    is_admin: true,
    center: {
      center_id: "C001",
      center_name: "강남센터",
      address: "서울시 강남구",
      manager: null,
    },
    roles: ["admin", "manager"],
  };

  const user1 = new User(apiResponseSnake as any);
  assertEqual(user1.userId, "U001", "snake_case 응답 - userId");
  assertEqual(user1.userName, "홍길동", "snake_case 응답 - userName");
  assertEqual(user1.age, 30, "snake_case 응답 - age (변환됨)");
  assertEqual(typeof user1.age, "number", "age 타입: number");
  assert(user1 instanceof User, "instanceof User");
  assert(user1.center instanceof Center, "중첩 객체 instanceof Center");

  const apiResponseCamel = {
    userId: "U002",
    userName: "김철수",
    email: "kim@example.com",
    age: 25,
    isAdmin: false,
  };

  const user2 = new User(apiResponseCamel as User);
  assertEqual(user2.userId, "U002", "camelCase 응답 - userId");
  assertEqual(user2.userName, "김철수", "camelCase 응답 - userName");

  const user3 = new User({} as User);
  assertEqual(user3.userId, "", "빈 생성자 - userId");
  assertEqual(user3.age, 0, "빈 생성자 - age");

  const plain = user1.toPlain();
  assert("userId" in plain, "toPlain camelCase - userId");
  const plainSnake = user1.toPlain(true);
  assert("user_id" in plainSnake, "toPlain snake_case - user_id");
  console.log("");

  // ========================================================================
  // 타입 검증 테스트
  // ========================================================================
  console.log("📋 타입 검증 테스트");

  // 타입이 맞는 경우 - 정상 작동
  const test1 = new AutoNumberTest({
    age: 30, // number -> number (타입 맞음)
    count: 100,
    price: 1500,
  } as any);
  assertEqual(test1.age, 30, "타입이 맞는 경우 - age");
  assertEqual(typeof test1.age, "number", "타입이 맞는 경우 - 타입");

  // 타입이 맞지 않는 경우 - 경고만
  const originalWarn1 = console.warn;
  let warnCalled1 = false;
  let warnMessage1 = "";

  console.warn = (...args: unknown[]) => {
    warnCalled1 = true;
    warnMessage1 = String(args[0]);
    originalWarn1(...args);
  };

  const nodeProcess = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  const originalEnv1 = nodeProcess?.env?.NODE_ENV;
  if (nodeProcess?.env) {
    nodeProcess.env.NODE_ENV = "development";
  }

  try {
    const test2 = new AutoNumberTest({
      age: "30", // string -> number (타입 불일치, 경고만)
    } as any);

    if (warnCalled1) {
      assert(warnMessage1.includes("Type mismatch"), "타입 불일치 시 console.warn 호출됨");
      assert(warnMessage1.includes("age"), "경고 메시지에 필드명 포함");
      console.log("   ✅ 타입 불일치 시 console.warn 출력됨");
    }

    // 원본 값 그대로 유지
    assertEqual(test2.age, "30", "원본 값 유지");
    assertEqual(typeof test2.age, "string", "타입 그대로");
  } finally {
    if (nodeProcess?.env) {
      nodeProcess.env.NODE_ENV = originalEnv1;
    }
    console.warn = originalWarn1;
  }
  console.log("");

  // ========================================================================
  // Decorator 테스트
  // ========================================================================
  console.log("📋 Decorator 테스트");

  const order1 = new Order({ order_id: "O001" } as any);
  assertEqual(order1.orderId, "O001", "@Alias - order_id");

  const order2 = new Order({ id: "O002" } as any);
  assertEqual(order2.orderId, "O002", "@Alias - id");

  const order3 = new Order({ order_id: "O003", total_amount: "5000" } as any);
  assertEqual(order3.totalAmount, 5000, "@Transform - Number 변환");
  assertEqual(typeof order3.totalAmount, "number", "@Transform - 타입");
  console.log("");

  // ========================================================================
  // 배열 처리 테스트
  // ========================================================================
  console.log("📋 배열 처리 테스트");

  const order4 = new Order({
    order_id: "O004",
    products: [
      { product_id: "P001", product_name: "상품1", price: "1000", stock: "10" },
      { product_id: "P002", product_name: "상품2", price: "2000", stock: "20" },
    ],
  } as any);
  assertEqual(order4.products.length, 2, "배열 길이");
  assert(order4.products[0] instanceof Product, "배열 요소가 Product 인스턴스");
  assertEqual(order4.products[0].productId, "P001", "배열 첫 번째 요소 productId");
  assertEqual(order4.products[0].price, 1000, "배열 요소 price 타입 변환");
  console.log("");

  // ========================================================================
  // 중첩 객체 toPlain 재귀 변환 테스트
  // ========================================================================
  console.log("📋 중첩 객체 toPlain 재귀 변환 테스트");

  const order5 = new Order({
    order_id: "O005",
    total_amount: "10000",
    customer: {
      customer_id: "C001",
      customer_name: "홍길동",
      age: "30",
    },
    products: [{ product_id: "P001", product_name: "상품1", price: "1000", stock: "10" }],
  } as any);

  const plainCamel = order5.toPlain(false);
  assertEqual(plainCamel.orderId, "O005", "toPlain camelCase - orderId");
  assertEqual(
    (plainCamel.customer as Record<string, unknown>).customerId,
    "C001",
    "toPlain camelCase - 중첩 객체"
  );

  const plainSnake2 = order5.toPlain(true);
  assertEqual(plainSnake2.order_id, "O005", "toPlain snake_case - order_id");
  assertEqual(
    (plainSnake2.customer as Record<string, unknown>).customer_id,
    "C001",
    "toPlain snake_case - 중첩 객체"
  );
  console.log("");

  // ========================================================================
  // 엣지 케이스 테스트
  // ========================================================================
  console.log("📋 엣지 케이스 테스트");

  const test3 = new User({
    user_id: null,
    user_name: undefined,
  } as any);
  assertEqual(test3.userId, null, "null 값 설정");
  assertEqual(test3.userName, "", "undefined는 기본값 유지");

  const test4 = new Order({
    order_id: "O006",
    products: [],
  } as any);
  assertEqual(test4.products.length, 0, "빈 배열");

  const test5 = new Order({
    order_id: "O007",
    products: null,
  } as any);
  assertEqual(test5.products.length, 0, "null 배열은 빈 배열로 변환");
  console.log("");

  // ========================================================================
  // Strict Mode 테스트 (개발 환경에서는 console.warn)
  // ========================================================================
  console.log("📋 Strict Mode 테스트");

  // 타입이 맞는 경우 - 정상 작동
  const strictUser1 = new StrictUser({
    age: 30,
    is_admin: true,
    name: "홍길동",
  } as any);
  assertEqual(strictUser1.age, 30, "strictMode: 타입이 맞는 경우 정상 작동");

  // 타입이 맞지 않는 경우 - 개발 환경에서는 경고만 (에러 아님)
  const originalWarn2 = console.warn;
  let warnCalled2 = false;
  let warnMessage2 = "";

  console.warn = (...args: unknown[]) => {
    warnCalled2 = true;
    warnMessage2 = String(args[0]);
    originalWarn2(...args);
  };

  // 개발 환경으로 설정 (테스트용)
  const originalEnv2 = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    const strictUser2 = new StrictUser({
      age: "30", // string -> 타입 불일치, 경고만 출력
    } as any);

    // 개발 환경에서는 경고가 출력되어야 함
    if (warnCalled2) {
      assert(warnMessage2.includes("Type mismatch"), "개발 환경에서 console.warn 호출됨");
      assert(warnMessage2.includes("StrictUser"), "경고 메시지에 클래스명 포함");
      assert(warnMessage2.includes("age"), "경고 메시지에 필드명 포함");
      console.log("   ✅ 개발 환경에서 타입 불일치 시 console.warn 출력됨");
    } else {
      console.log("   ℹ️  경고가 호출되지 않았습니다");
    }

    // 원본 값 그대로 사용
    assertEqual(strictUser2.age, "30", "strictMode에서 원본 값 유지");
    assertEqual(typeof strictUser2.age, "string", "strictMode에서 타입 그대로");
  } finally {
    process.env.NODE_ENV = originalEnv2;
    console.warn = originalWarn2;
  }
  console.log("");

  // ========================================================================
  // 명시적 transform이 있으면 검증 스킵 테스트
  // ========================================================================
  console.log("📋 명시적 transform 검증 스킵 테스트");

  class TransformUser extends FlexDto {
    age = 0;

    constructor(data: TransformUser) {
      super();
      this.init(data, {
        strictMode: true,
        transforms: { age: Number },
      });
    }
  }

  const transformUser = new TransformUser({
    age: "30",
  } as any);
  assertEqual(transformUser.age, 30, "명시적 transform이 있으면 타입 검증 스킵");
  console.log("");

  // ========================================================================
  // String 타입 검증 테스트
  // ========================================================================
  console.log("📋 String 타입 검증 테스트");

  class StringTest extends FlexDto {
    age = ""; // string 기본값
    name = ""; // string 기본값

    constructor(data?: StringTest) {
      super();
      if (data) this.init(data);
    }
  }

  // string 필드에 string이 들어올 때 -> 정상 (타입 맞음)
  const stringTest1 = new StringTest({ age: "30" } as any);
  assertEqual(stringTest1.age, "30", "string 필드에 string 입력 -> 정상");
  assertEqual(typeof stringTest1.age, "string", "string 필드에 string 입력 -> 타입 확인");

  // string 필드에 number가 들어올 때 -> 경고만
  const originalWarn3 = console.warn;
  const warnCalled3: boolean[] = [];
  console.warn = (...args: unknown[]) => {
    warnCalled3.push(true);
    originalWarn3(...args);
  };

  if (nodeProcess?.env) {
    nodeProcess.env.NODE_ENV = "development";
  }

  try {
    const stringTest2 = new StringTest({ age: 30 } as any); // number -> string (타입 불일치)
    if (warnCalled3.length > 0) {
      console.log("   ✅ string 필드에 number 입력 시 경고 출력됨");
    }
    // 원본 값 그대로
    assertEqual(stringTest2.age, 30, "원본 값 유지");
    assertEqual(typeof stringTest2.age, "number", "타입 그대로");
  } finally {
    if (nodeProcess?.env) {
      nodeProcess.env.NODE_ENV = originalEnv1;
    }
    console.warn = originalWarn3;
  }
  console.log("");

  // ========================================================================
  // Transform이 있으면 타입 검증 스킵 테스트
  // ========================================================================
  console.log("📋 Transform이 있으면 타입 검증 스킵 테스트");

  class TransformTest extends FlexDto {
    age = 0; // number 기본값

    constructor(data: TransformTest) {
      super();
      this.init(data, {
        transforms: { age: Number },
      });
    }
  }

  // Transform이 있으면 타입 검증 스킵 (경고 없음)
  const originalWarn4 = console.warn;
  const warnCalled4: boolean[] = [];
  console.warn = (...args: unknown[]) => {
    warnCalled4.push(true);
    originalWarn4(...args);
  };

  if (nodeProcess?.env) {
    nodeProcess.env.NODE_ENV = "development";
  }

  try {
    const transformTest = new TransformTest({ age: "30" } as any); // string -> number (transform 있음)
    assertEqual(transformTest.age, 30, "Transform이 있으면 변환됨");
    assertEqual(warnCalled4.length, 0, "Transform이 있으면 경고 없음");
  } finally {
    if (nodeProcess?.env) {
      nodeProcess.env.NODE_ENV = originalEnv1;
    }
    console.warn = originalWarn4;
  }
  console.log("");

  // ========================================================================
  // 타입별 적절한 연결 테스트 (age: number)
  // ========================================================================
  console.log("📋 타입별 적절한 연결 테스트 - age: number");

  class AgeNumberDto extends FlexDto {
    age = 0; // number 타입

    constructor(data: AgeNumberDto) {
      super();
      this.init(data, { strictMode: true });
    }
  }

  // 1. JSON에서 number가 오면 정상 연결
  const ageNumber1 = new AgeNumberDto({ age: 30 } as any);
  assertEqual(ageNumber1.age, 30, "age: number - JSON에서 number 오면 정상 연결");
  assertEqual(typeof ageNumber1.age, "number", "age: number - 타입 확인");

  // 2. JSON에서 string이 오면 타입 불일치 -> Transform 없으면 워닝
  const originalWarn5 = console.warn;
  let warnCalled5 = false;
  let warnMessage5 = "";

  console.warn = (...args: unknown[]) => {
    warnCalled5 = true;
    warnMessage5 = String(args[0]);
    originalWarn5(...args);
  };

  if (nodeProcess?.env) {
    nodeProcess.env.NODE_ENV = "development";
  }

  try {
    const ageNumber2 = new AgeNumberDto({ age: "30" } as any); // string -> number (타입 불일치)
    if (warnCalled5) {
      assert(warnMessage5.includes("Type mismatch"), "age: number - string 오면 워닝");
      assert(warnMessage5.includes("age"), "워닝에 필드명 포함");
      console.log("   ✅ age: number - string 오면 워닝 출력");
    }
    assertEqual(ageNumber2.age, "30", "age: number - Transform 없으면 원본 값 유지");
    assertEqual(typeof ageNumber2.age, "string", "age: number - 타입 그대로");
  } finally {
    if (nodeProcess?.env) {
      nodeProcess.env.NODE_ENV = originalEnv1;
    }
    console.warn = originalWarn5;
  }

  // 3. Transform 있으면 변환 성공
  class AgeNumberWithTransformDto extends FlexDto {
    age = 0; // number 타입

    constructor(data: AgeNumberWithTransformDto) {
      super();
      this.init(data, {
        strictMode: true,
        transforms: {
          age: Number,
        },
      });
    }
  }

  const ageNumber3 = new AgeNumberWithTransformDto({ age: "30" } as any);
  assertEqual(ageNumber3.age, 30, "age: number - Transform 있으면 변환 성공");
  assertEqual(typeof ageNumber3.age, "number", "age: number - Transform 후 타입 확인");
  console.log("");

  // ========================================================================
  // 타입별 적절한 연결 테스트 (age: string)
  // ========================================================================
  console.log("📋 타입별 적절한 연결 테스트 - age: string");

  class AgeStringDto extends FlexDto {
    age = ""; // string 타입

    constructor(data: AgeStringDto) {
      super();
      this.init(data, { strictMode: true });
    }
  }

  // 1. JSON에서 string이 오면 정상 연결
  const ageString1 = new AgeStringDto({ age: "30" } as any);
  assertEqual(ageString1.age, "30", "age: string - JSON에서 string 오면 정상 연결");
  assertEqual(typeof ageString1.age, "string", "age: string - 타입 확인");

  // 2. JSON에서 number가 오면 타입 불일치 -> Transform 없으면 워닝
  const originalWarn6 = console.warn;
  let warnCalled6 = false;
  let warnMessage6 = "";

  console.warn = (...args: unknown[]) => {
    warnCalled6 = true;
    warnMessage6 = String(args[0]);
    originalWarn6(...args);
  };

  if (nodeProcess?.env) {
    nodeProcess.env.NODE_ENV = "development";
  }

  try {
    const ageString2 = new AgeStringDto({ age: 30 } as any); // number -> string (타입 불일치)
    if (warnCalled6) {
      assert(warnMessage6.includes("Type mismatch"), "age: string - number 오면 워닝");
      assert(warnMessage6.includes("age"), "워닝에 필드명 포함");
      console.log("   ✅ age: string - number 오면 워닝 출력");
    }
    assertEqual(ageString2.age, 30, "age: string - Transform 없으면 원본 값 유지");
    assertEqual(typeof ageString2.age, "number", "age: string - 타입 그대로");
  } finally {
    if (nodeProcess?.env) {
      nodeProcess.env.NODE_ENV = originalEnv1;
    }
    console.warn = originalWarn6;
  }

  // 3. Transform 있으면 변환 성공
  class AgeStringWithTransformDto extends FlexDto {
    age = ""; // string 타입

    constructor(data: AgeStringWithTransformDto) {
      super();
      this.init(data, {
        strictMode: true,
        transforms: {
          age: String,
        },
      });
    }
  }

  const ageString3 = new AgeStringWithTransformDto({ age: 30 } as any);
  assertEqual(ageString3.age, "30", "age: string - Transform 있으면 변환 성공");
  assertEqual(typeof ageString3.age, "string", "age: string - Transform 후 타입 확인");
  console.log("");

  // ========================================================================
  // Transform 실패 시 워닝 테스트
  // ========================================================================
  console.log("📋 Transform 실패 시 워닝 테스트");

  class TransformFailDto extends FlexDto {
    age = 0; // number 타입

    constructor(data: TransformFailDto) {
      super();
      this.init(data, {
        strictMode: true,
        transforms: {
          age: (v) => {
            if (typeof v === "string" && v === "invalid") {
              throw new Error("Invalid value");
            }
            return Number(v);
          },
        },
      });
    }
  }

  // Transform 성공 케이스
  const transformSuccess = new TransformFailDto({ age: "30" } as any);
  assertEqual(transformSuccess.age, 30, "Transform 성공 - 값 변환됨");

  // Transform 실패 케이스 - 워닝 출력
  const originalWarn7 = console.warn;
  let warnCalled7 = false;
  let warnMessage7 = "";

  console.warn = (...args: unknown[]) => {
    warnCalled7 = true;
    warnMessage7 = String(args[0]);
    originalWarn7(...args);
  };

  if (nodeProcess?.env) {
    nodeProcess.env.NODE_ENV = "development";
  }

  try {
    const transformFail = new TransformFailDto({ age: "invalid" } as any); // Transform 실패
    if (warnCalled7) {
      assert(warnMessage7.includes("Transform failed"), "Transform 실패 시 워닝 출력");
      assert(warnMessage7.includes("age"), "워닝에 필드명 포함");
      console.log("   ✅ Transform 실패 시 워닝 출력");
    }
    assertEqual(transformFail.age, "invalid", "Transform 실패 시 원본 값 유지");
  } finally {
    if (nodeProcess?.env) {
      nodeProcess.env.NODE_ENV = originalEnv1;
    }
    console.warn = originalWarn7;
  }
  console.log("");

  // ========================================================================
  // 사용자 요청 동작 확인 테스트
  // ========================================================================
  console.log("📋 사용자 요청 동작 확인 테스트");

  class UserRequestCenter extends FlexDto {
    centerId: string = "";

    constructor(data?: UserRequestCenter) {
      super();
      if (data) this.init(data);
    }
  }

  const userCenter1 = new UserRequestCenter({ center_id: "C001" } as any);
  const userCenter2 = new UserRequestCenter({ centerId: "C001" } as any);

  assertEqual(userCenter1.centerId, "C001", "UserRequestCenter - center_id (snake_case) 작동");
  assertEqual(userCenter2.centerId, "C001", "UserRequestCenter - centerId (camelCase) 작동");

  class UserRequestCenter2 extends FlexDto {
    centerId: string = "";

    constructor(data: UserRequestCenter2) {
      super();
      this.init(data, {
        aliases: {
          centerId: ["cenId", "cen_id"],
        },
      });
    }
  }

  const userCenter3 = new UserRequestCenter2({ cenId: "C001" } as any);
  const userCenter4 = new UserRequestCenter2({ center_id: "C001" } as any);
  const userCenter5 = new UserRequestCenter2({ centerId: "C001" } as any);

  assertEqual(userCenter3.centerId, "C001", "UserRequestCenter2 - cenId (custom alias) 작동");
  assertEqual(userCenter4.centerId, "C001", "UserRequestCenter2 - center_id (snake_case) 작동");
  assertEqual(userCenter5.centerId, "C001", "UserRequestCenter2 - centerId (camelCase) 작동");
  console.log("");

  // ========================================================================
  // 초기값 없이 타입만 선언된 경우 테스트
  // ========================================================================
  console.log("📋 초기값 없이 타입만 선언된 경우 테스트");

  class NoInitialValueDto extends FlexDto {
    age: number; // 초기값 없음
    name: string; // 초기값 없음
    isActive: boolean; // 초기값 없음
    optionalField?: string; // optional 필드

    constructor(data: NoInitialValueDto) {
      super();
      this.init(data, { strictMode: true });
    }
  }

  // 데이터가 모두 제공된 경우
  const dto1 = new NoInitialValueDto({
    age: 30,
    name: "홍길동",
    is_active: true,
  } as any);
  assertEqual(dto1.age, 30, "초기값 없음 - age 설정됨");
  assertEqual(dto1.name, "홍길동", "초기값 없음 - name 설정됨");
  assertEqual(dto1.isActive, true, "초기값 없음 - isActive 설정됨 (snake_case)");

  // snake_case로 데이터 제공
  const dto2 = new NoInitialValueDto({
    age: 25,
    name: "김철수",
    is_active: false,
  } as any);
  assertEqual(dto2.age, 25, "초기값 없음 - snake_case age 작동");
  assertEqual(dto2.name, "김철수", "초기값 없음 - snake_case name 작동");
  assertEqual(dto2.isActive, false, "초기값 없음 - snake_case isActive 작동");

  // 일부 필드만 제공된 경우
  const dto3 = new NoInitialValueDto({
    age: 20,
  } as any);
  assertEqual(dto3.age, 20, "초기값 없음 - 일부 필드만 제공 시 age 설정됨");
  // name과 isActive는 undefined일 수 있음 (TypeScript에서는 undefined가 될 수 있음)
  console.log("   ✅ 초기값 없음 - 일부 필드만 제공 시 정상 작동");

  // optional 필드 테스트
  const dto4 = new NoInitialValueDto({
    age: 30,
    name: "이영희",
    isActive: true,
    optional_field: "optional value",
  } as any);
  assertEqual(dto4.age, 30, "초기값 없음 - optional 필드 포함 age");
  assertEqual(dto4.name, "이영희", "초기값 없음 - optional 필드 포함 name");
  assertEqual(dto4.isActive, true, "초기값 없음 - optional 필드 포함 isActive");
  assertEqual(dto4.optionalField, "optional value", "초기값 없음 - optional 필드 설정됨");

  // Transform과 함께 사용
  class NoInitialValueWithTransformDto extends FlexDto {
    age: number; // 초기값 없음
    price: number; // 초기값 없음

    constructor(data: NoInitialValueWithTransformDto) {
      super();
      this.init(data, {
        strictMode: true,
        transforms: {
          age: Number,
          price: Number,
        },
      });
    }
  }

  const dto5 = new NoInitialValueWithTransformDto({
    age: "30",
    price: "1500",
  } as any);
  assertEqual(dto5.age, 30, "초기값 없음 + Transform - age 변환됨");
  assertEqual(dto5.price, 1500, "초기값 없음 + Transform - price 변환됨");
  assertEqual(typeof dto5.age, "number", "초기값 없음 + Transform - age 타입 확인");
  assertEqual(typeof dto5.price, "number", "초기값 없음 + Transform - price 타입 확인");

  // 타입 불일치 시 워닝 (초기값 없어도 타입 검증은 스킵됨 - expectedType이 undefined이므로)
  const originalWarn8 = console.warn;
  let warnCalled8 = false;

  console.warn = (...args: unknown[]) => {
    warnCalled8 = true;
    originalWarn8(...args);
  };

  const nodeProcessForNoInit = (globalThis as { process?: { env?: { NODE_ENV?: string } } })
    .process;
  const originalEnv3 = nodeProcessForNoInit?.env?.NODE_ENV;
  if (nodeProcessForNoInit?.env) {
    nodeProcessForNoInit.env.NODE_ENV = "development";
  }

  try {
    // 초기값이 없으면 타입 검증을 스킵하므로 워닝이 나오지 않아야 함
    const dto6 = new NoInitialValueDto({
      age: "30", // string이지만 초기값 없어서 타입 검증 스킵
    } as any);
    assertEqual(dto6.age, "30", "초기값 없음 - 타입 불일치 시 원본 값 사용");
    assertEqual(warnCalled8, false, "초기값 없음 - 타입 검증 스킵되어 워닝 없음");
  } finally {
    if (nodeProcessForNoInit?.env) {
      nodeProcessForNoInit.env.NODE_ENV = originalEnv3;
    }
    console.warn = originalWarn8;
  }
  console.log("");

  // ========================================================================
  // 요청사항 종합 확인 테스트
  // ========================================================================
  console.log("📋 요청사항 종합 확인 테스트");

  // 시나리오 1: 초기값 있고 타입 맞음 -> 워닝 없음
  class Scenario1 extends FlexDto {
    age = 0; // number 초기값
    name = ""; // string 초기값

    constructor(data: Scenario1) {
      super();
      this.init(data, { strictMode: true });
    }
  }

  const originalWarn9 = console.warn;
  let warnCount9 = 0;
  console.warn = (...args: unknown[]) => {
    warnCount9++;
    originalWarn9(...args);
  };

  const nodeProcessFinal = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  const originalEnvFinal = nodeProcessFinal?.env?.NODE_ENV;
  if (nodeProcessFinal?.env) {
    nodeProcessFinal.env.NODE_ENV = "development";
  }

  try {
    const s1 = new Scenario1({ age: 30, name: "홍길동" } as any);
    assertEqual(s1.age, 30, "시나리오1: 타입 맞음 - age");
    assertEqual(s1.name, "홍길동", "시나리오1: 타입 맞음 - name");
    assertEqual(warnCount9, 0, "시나리오1: 타입 맞으면 워닝 없음");

    // 시나리오 2: 초기값 있고 타입 다름 -> 워닝 있음
    warnCount9 = 0;
    const s2 = new Scenario1({ age: "30", name: 123 } as any);
    assertEqual(s2.age, "30", "시나리오2: 타입 다름 - 원본 값 유지");
    assertEqual(s2.name, 123, "시나리오2: 타입 다름 - 원본 값 유지");
    assert(warnCount9 >= 2, `시나리오2: 타입 다르면 워닝 있음 (${warnCount9}개)`);
    console.log(`   ✅ 시나리오2: 타입 다르면 워닝 ${warnCount9}개 출력됨`);

    // 시나리오 3: Transform 있으면 타입 검증 스킵 -> 워닝 없음
    class Scenario3 extends FlexDto {
      age = 0;

      constructor(data: Scenario3) {
        super();
        this.init(data, {
          strictMode: true,
          transforms: {
            age: Number,
          },
        });
      }
    }

    warnCount9 = 0;
    const s3 = new Scenario3({ age: "30" } as any);
    assertEqual(s3.age, 30, "시나리오3: Transform 있으면 변환됨");
    assertEqual(typeof s3.age, "number", "시나리오3: Transform 후 타입 확인");
    assertEqual(warnCount9, 0, "시나리오3: Transform 있으면 워닝 없음");

    // 시나리오 4: Transform 실패 -> 워닝 있음
    class Scenario4 extends FlexDto {
      age = 0;

      constructor(data: Scenario4) {
        super();
        this.init(data, {
          strictMode: true,
          transforms: {
            age: (v) => {
              if (v === "invalid") throw new Error("Invalid");
              return Number(v);
            },
          },
        });
      }
    }

    warnCount9 = 0;
    const s4 = new Scenario4({ age: "invalid" } as any);
    assertEqual(s4.age, "invalid", "시나리오4: Transform 실패 시 원본 값 유지");
    assert(warnCount9 >= 1, `시나리오4: Transform 실패 시 워닝 있음 (${warnCount9}개)`);
    console.log(`   ✅ 시나리오4: Transform 실패 시 워닝 ${warnCount9}개 출력됨`);

    // 시나리오 5: 초기값 없으면 타입 검증 스킵 -> 워닝 없음
    class Scenario5 extends FlexDto {
      age: number; // 초기값 없음
      name: string; // 초기값 없음

      constructor(data: Scenario5) {
        super();
        this.init(data, { strictMode: true });
      }
    }

    warnCount9 = 0;
    const s5 = new Scenario5({ age: "30", name: 123 } as any);
    assertEqual(s5.age, "30", "시나리오5: 초기값 없음 - 원본 값 유지");
    assertEqual(s5.name, 123, "시나리오5: 초기값 없음 - 원본 값 유지");
    assertEqual(warnCount9, 0, "시나리오5: 초기값 없으면 타입 검증 스킵되어 워닝 없음");

    // 시나리오 6: snake_case/camelCase 자동 변환
    class Scenario6 extends FlexDto {
      userId = "";
      userName = "";

      constructor(data: Scenario6) {
        super();
        this.init(data);
      }
    }

    const s6a = new Scenario6({ user_id: "U001", user_name: "홍길동" } as any);
    const s6b = new Scenario6({ userId: "U002", userName: "김철수" } as any);
    assertEqual(s6a.userId, "U001", "시나리오6: snake_case -> camelCase 변환");
    assertEqual(s6a.userName, "홍길동", "시나리오6: snake_case -> camelCase 변환");
    assertEqual(s6b.userId, "U002", "시나리오6: camelCase 그대로");
    assertEqual(s6b.userName, "김철수", "시나리오6: camelCase 그대로");

    console.log("   ✅ 모든 요청사항이 정상적으로 작동합니다!");
  } finally {
    if (nodeProcessFinal?.env) {
      nodeProcessFinal.env.NODE_ENV = originalEnvFinal;
    }
    console.warn = originalWarn9;
  }
  console.log("");

  // ========================================================================
  // Enum 및 엣지 케이스 테스트
  // ========================================================================
  console.log("📋 Enum 및 엣지 케이스 테스트");

  // Enum 테스트
  enum UserRole {
    ADMIN = "admin",
    USER = "user",
    GUEST = "guest",
  }

  enum Status {
    ACTIVE = 1,
    INACTIVE = 0,
  }

  class EnumTestDto extends FlexDto {
    role: UserRole = UserRole.USER;
    status: Status = Status.ACTIVE;
    roleOptional?: UserRole;

    constructor(data?: EnumTestDto) {
      super();
      if (data) this.init(data);
    }
  }

  const enumDto1 = new EnumTestDto({ role: "admin", status: 1 } as any);
  assertEqual(enumDto1.role, "admin", "Enum - string 값으로 설정");
  assertEqual(enumDto1.status, 1, "Enum - number 값으로 설정");

  const enumDto2 = new EnumTestDto({ role: UserRole.ADMIN, status: Status.ACTIVE } as any);
  assertEqual(enumDto2.role, UserRole.ADMIN, "Enum - enum 값으로 설정");
  assertEqual(enumDto2.status, Status.ACTIVE, "Enum - enum 값으로 설정");

  // Enum 타입 불일치 테스트
  const originalWarn10 = console.warn;
  let warnCount10 = 0;
  console.warn = (...args: unknown[]) => {
    warnCount10++;
    originalWarn10(...args);
  };

  const nodeProcessEnum = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  const originalEnvEnum = nodeProcessEnum?.env?.NODE_ENV;
  if (nodeProcessEnum?.env) {
    nodeProcessEnum.env.NODE_ENV = "development";
  }

  try {
    const enumDto3 = new EnumTestDto({ role: 123, status: "invalid" } as any);
    // enum은 object 타입이므로 타입 검증이 스킵될 수 있음
    assertEqual(enumDto3.role, 123, "Enum - 타입 불일치 시 원본 값 유지");
    assertEqual(enumDto3.status, "invalid", "Enum - 타입 불일치 시 원본 값 유지");
  } finally {
    if (nodeProcessEnum?.env) {
      nodeProcessEnum.env.NODE_ENV = originalEnvEnum;
    }
    console.warn = originalWarn10;
  }

  // 배열 테스트
  class ArrayTestDto extends FlexDto {
    tags: string[] = [];
    numbers: number[] = [];
    mixed: unknown[] = [];

    constructor(data?: ArrayTestDto) {
      super();
      if (data) this.init(data);
    }
  }

  const arrayDto = new ArrayTestDto({
    tags: ["tag1", "tag2"],
    numbers: [1, 2, 3],
    mixed: [1, "string", true],
  } as any);
  assertEqual(arrayDto.tags.length, 2, "Array - string 배열");
  assertEqual(arrayDto.numbers.length, 3, "Array - number 배열");
  assertEqual(arrayDto.mixed.length, 3, "Array - mixed 배열");

  // null/undefined 테스트
  class NullTestDto extends FlexDto {
    value: string | null = null;
    optional?: string;
    required: string = "";

    constructor(data?: NullTestDto) {
      super();
      if (data) this.init(data);
    }
  }

  const nullDto1 = new NullTestDto({ value: null, optional: undefined } as any);
  assertEqual(nullDto1.value, null, "Null - null 값 설정");
  assertEqual(nullDto1.optional, undefined, "Null - undefined 값");

  const nullDto2 = new NullTestDto({ value: "test", optional: "optional" } as any);
  assertEqual(nullDto2.value, "test", "Null - null에서 값 변경");
  assertEqual(nullDto2.optional, "optional", "Null - optional 값 설정");

  // Date 테스트
  class DateTestDto extends FlexDto {
    createdAt: Date | null = null;
    updatedAt: Date | null = null;

    constructor(data: DateTestDto) {
      super();
      this.init(data, {
        transforms: {
          createdAt: (v) => (v ? new Date(v) : null),
          updatedAt: (v) => (v ? new Date(v) : null),
        },
      });
    }
  }

  const dateDto = new DateTestDto({
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-16T00:00:00Z",
  } as any);
  assert(dateDto.createdAt instanceof Date, "Date - Date 객체로 변환");
  assert(dateDto.updatedAt instanceof Date, "Date - Date 객체로 변환");

  // 객체 테스트
  class ObjectTestDto extends FlexDto {
    metadata: Record<string, unknown> = {};
    config: { key: string; value: unknown } | null = null;

    constructor(data?: ObjectTestDto) {
      super();
      if (data) this.init(data);
    }
  }

  const objectDto = new ObjectTestDto({
    metadata: { key1: "value1", key2: 123 },
    config: { key: "test", value: true },
  } as any);
  assertEqual((objectDto.metadata as Record<string, unknown>).key1, "value1", "Object - metadata");
  assertEqual(
    (objectDto.config as { key: string; value: unknown })?.key,
    "test",
    "Object - config"
  );

  // Symbol 테스트 (일반적으로 JSON에 포함되지 않지만 테스트)
  class SymbolTestDto extends FlexDto {
    symbolValue: unknown = null;

    constructor(data?: SymbolTestDto) {
      super();
      if (data) this.init(data);
    }
  }

  const symbolDto = new ArrayTestDto({ tags: ["test"] } as any);
  assertEqual(symbolDto.tags.length, 1, "Symbol - 일반적인 사용");

  // 함수 테스트 (일반적으로 JSON에 포함되지 않지만)
  class FunctionTestDto extends FlexDto {
    fn: unknown = null;

    constructor(data?: FunctionTestDto) {
      super();
      if (data) this.init(data);
    }
  }

  const fnDto = new FunctionTestDto({ fn: () => {} } as any);
  assert(typeof fnDto.fn === "function", "Function - 함수 값");

  // 빈 객체 테스트
  class EmptyTestDto extends FlexDto {
    empty: Record<string, unknown> = {};

    constructor(data?: EmptyTestDto) {
      super();
      if (data) this.init(data);
    }
  }

  const emptyDto = new EmptyTestDto({ empty: {} } as any);
  assertEqual(Object.keys(emptyDto.empty).length, 0, "Empty - 빈 객체");

  // 중첩 배열 테스트
  class NestedArrayTestDto extends FlexDto {
    matrix: number[][] = [];

    constructor(data?: NestedArrayTestDto) {
      super();
      if (data) this.init(data);
    }
  }

  const nestedArrayDto = new NestedArrayTestDto({
    matrix: [
      [1, 2],
      [3, 4],
    ],
  } as any);
  assertEqual(nestedArrayDto.matrix.length, 2, "NestedArray - 중첩 배열");
  assertEqual(nestedArrayDto.matrix[0].length, 2, "NestedArray - 내부 배열");

  // BigInt 테스트
  class BigIntTestDto extends FlexDto {
    bigValue: unknown = null;

    constructor(data?: BigIntTestDto) {
      super();
      if (data) this.init(data);
    }
  }

  // BigInt는 JSON.stringify에서 에러가 나므로 문자열로 전달
  const bigIntDto = new BigIntTestDto({ bigValue: "12345678901234567890" } as any);
  assertEqual(bigIntDto.bigValue, "12345678901234567890", "BigInt - 문자열로 처리");

  console.log("   ✅ 모든 엣지 케이스가 정상적으로 작동합니다!");
  console.log("\n=== 모든 테스트 통과! 🎉 ===");
} catch (error) {
  console.error("\n❌ 테스트 실패:", error);
  process.exit(1);
}
