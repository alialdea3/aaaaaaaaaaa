export const schema = `#graphql
    type Contact {
        id: ID!
        name: String!
        phone: String!
        country: String!
        time: String!
        contacts: [Contact!]!
    }

    type Query {
        getContact(id: ID!): Contact!
        getContacts: [Contact!]!
    }

    type Mutation {
        deleteContact(id: ID!): Boolean!
        addContacts(name: String!, phone: String!, contacts: [ID!]): Contact!
        updateContact(id: ID!, name: String, phone: String): Contact!
    }
`;
