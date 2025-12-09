# flex-dto

Flexible DTO mapper for frontend applications. Automatic snake_case/camelCase conversion with class instantiation.

## Installation

```bash
npm install flex-dto
```

## Quick Start

```typescript
import { FlexDto } from "flex-dto";

class User extends FlexDto {
  userId = "";
  userName = "";
  age = 0;

  constructor(data: User) {
    super();
    this.init(data);
  }
}

// Works with snake_case
const response = { user_id: "U001", user_name: "John", age: 30 };
const user = new User(response);

console.log(user.userId); // 'U001' (automatically converted)
console.log(user.userName); // 'John'

// Also works with camelCase
const camelResponse = { userId: "U002", userName: "Jane", age: 25 };
const user2 = new User(camelResponse);
```

## Features

- Automatic case conversion: snake_case to camelCase
- Type validation: Warns about type mismatches in development (never throws)
- Strict mode: Auto-detected from `NODE_ENV` (dev = on, prod = off)
- Class instantiation: Proper `instanceof` support for nested objects
- Type transforms: Explicit type conversion (strings to numbers, dates, etc.)
- Custom aliases: Map any field name to your class properties
- Array support: Handle arrays and nested DTO arrays automatically

## Type Validation & Transforms

Values are used as-is. Type mismatches show warnings in development mode:

```typescript
class User extends FlexDto {
  age = 0; // number type
  name = ""; // string type

  constructor(data: User) {
    super();
    this.init(data); // strictMode auto-detected from NODE_ENV
  }
}

// Type matches - no warning
new User({ age: 30, name: "John" });

// Type mismatch - warning in development
new User({ age: "30", name: 123 });
// Warning: Type mismatch in User.age: Expected number, but got string
// Values used as-is: age = "30", name = 123
```

**Use transforms for type conversion:**

```typescript
class Product extends FlexDto {
  price = 0;
  createdAt: Date | null = null;

  constructor(data: Product) {
    super();
    this.init(data, {
      transforms: {
        price: Number,
        createdAt: (v) => (v ? new Date(v) : null),
      },
    });
  }
}

const product = new Product({
  price: "1500", // -> 1500 (number)
  created_at: "2025-12-20", // -> Date object
});
```

**Note**:

- Transform provided -> No type validation
- Transform fails -> Warning shown, original value used
- No initial value -> Type validation skipped

## Nested DTOs

```typescript
class Center extends FlexDto {
  centerId = "";
  centerName = "";

  constructor(data: Center) {
    super();
    this.init(data);
  }
}

class User extends FlexDto {
  userId = "";
  center: Center | null = null;

  constructor(data: User) {
    super();
    this.init(data, {
      transforms: {
        center: (v) => (v ? new Center(v) : null),
      },
    });
  }
}

const user = new User({
  user_id: "U001",
  center: { center_id: "C001", center_name: "Main" },
});

console.log(user.center instanceof Center); // true
console.log(user.center?.centerId); // 'C001'
```

## Arrays

```typescript
class Product extends FlexDto {
  productId = "";
  productName = "";
  price = 0;

  constructor(data: Product) {
    super();
    this.init(data, {
      transforms: {
        price: Number,
      },
    });
  }
}

class Order extends FlexDto {
  orderId = "";
  products: Product[] = [];

  constructor(data: Order) {
    super();
    this.init(data, {
      transforms: {
        products: (v) => (Array.isArray(v) ? v.map((item) => new Product(item)) : []),
      },
    });
  }
}

const order = new Order({
  order_id: "O001",
  products: [
    { product_id: "P001", product_name: "Item 1", price: "1000" },
    { product_id: "P002", product_name: "Item 2", price: "2000" },
  ],
});

console.log(order.products.length); // 2
console.log(order.products[0] instanceof Product); // true
console.log(order.products[0].price); // 1000 (number)
```

## Custom Aliases

```typescript
class Payment extends FlexDto {
  paymentId = "";

  constructor(data: Payment) {
    super();
    this.init(data, {
      aliases: {
        paymentId: ["pay_id", "payId", "id"],
      },
    });
  }
}

// All work: paymentId, payment_id, pay_id, payId, id
new Payment({ payment_id: "P001" });
new Payment({ pay_id: "P001" });
new Payment({ id: "P001" });
```

## Decorators (Optional)

```typescript
import { FlexDto, Alias, Transform } from "flex-dto";

class Payment extends FlexDto {
  @Alias("pay_id", "payId")
  paymentId = "";

  @Transform(Number)
  amount = 0;

  constructor(data: Payment) {
    super();
    this.init(data);
  }
}
```

**Requires** `experimentalDecorators: true` in `tsconfig.json`.

## Output to Plain Object

```typescript
const user = new User({ user_id: "U001", user_name: "John" });

// Convert to plain object (camelCase by default)
user.toPlain(); // { userId: 'U001', userName: 'John' }

// Convert to snake_case for API requests
user.toPlain(true); // { user_id: 'U001', user_name: 'John' }

// JSON serialization (uses camelCase)
JSON.stringify(user); // Uses toJSON() internally
```

## Strict Mode

Auto-detected from `NODE_ENV`:

- `NODE_ENV=development` -> `strictMode: true` (warnings enabled)
- `NODE_ENV=production` -> `strictMode: false` (warnings disabled)

**Override:**

```typescript
this.init(data, { strictMode: true }); // Always enable
this.init(data, { strictMode: false }); // Always disable
```

**Browser**: In browser environments where `NODE_ENV` is not available, set `window.__FLEX_DTO_STRICT__ = true` to enable strict mode.

## License

MIT
