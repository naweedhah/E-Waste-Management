/**
 * Read-only GraphQL API for the storefront.
 *
 * REST stays the API for writes (checkout, bookings, admin). GraphQL suits the read side:
 * the product page, catalogue cards and "my orders" each need different slices of the same
 * data, and clients can fetch exactly those fields in one round trip.
 */
export const typeDefs = /* GraphQL */ `
  enum Category {
    laptops
    smartphones
    wearables
    tablets
    accessories
  }

  enum Condition {
    excellent
    good
    fair
    poor
  }

  enum ProductSort {
    NEWEST
    PRICE_ASC
    PRICE_DESC
    NAME
  }

  type Discount {
    name: String!
    type: String!
    value: Float!
    endsAt: String!
  }

  type Product {
    id: ID!
    name: String!
    category: Category!
    condition: Condition
    brand: String
    description: String
    "List price in LKR."
    price: Float!
    "Price after any discount that is active right now."
    finalPrice: Float!
    discount: Discount
    stockQuantity: Int!
    inStock: Boolean!
    images: [String!]!
    rating: Float
  }

  type ProductPage {
    items: [Product!]!
    total: Int!
    page: Int!
    pageSize: Int!
    hasNextPage: Boolean!
  }

  input ProductFilter {
    search: String
    category: Category
    condition: Condition
    minPrice: Float
    maxPrice: Float
  }

  type CategoryStats {
    category: Category!
    count: Int!
    minPrice: Float!
    maxPrice: Float!
  }

  type OrderItem {
    "Null if the product has since been deleted; name and price are kept on the order."
    product: Product
    name: String!
    quantity: Int!
    price: Float!
    lineTotal: Float!
  }

  type Order {
    id: ID!
    orderNumber: String!
    orderStatus: String!
    paymentStatus: String!
    paymentMethod: String!
    totalAmount: Float!
    createdAt: String!
    items: [OrderItem!]!
  }

  type Me {
    id: ID!
    name: String!
    email: String!
    role: String!
    orders(limit: Int = 10): [Order!]!
  }

  type Query {
    products(filter: ProductFilter, sort: ProductSort = NEWEST, page: Int = 1, pageSize: Int = 12): ProductPage!
    product(id: ID!): Product
    categories: [CategoryStats!]!
    "The signed-in customer (send the same Bearer token as the REST API). Null when anonymous."
    me: Me
  }
`;
