import { GraphQLError } from "graphql";
import { ObjectId, Collection } from "mongodb";
import { APIPhone, APITime, ContactModel } from "./type.ts";

type GetContactQueryArgs = { id: string };
type DeleteContactMutationArgs = { id: string };
type AddContactMutationArgs = { name: string; phone: string; contacts: ObjectId[] };
type UpdateContactMutationArgs = { id: string; name?: string; phone?: string; contacts?: ObjectId[] };

type Context = { ContactCollection: Collection<ContactModel> };

export const resolvers = {
    Query: {
        getContact: async (_: unknown, args: GetContactQueryArgs, ctx: Context): Promise<ContactModel | null> => {
            return await ctx.ContactCollection.findOne({ _id: new ObjectId(args.id) });
        },
        getContacts: async (_: unknown, __: unknown, ctx: Context): Promise<ContactModel[]> => {
            return await ctx.ContactCollection.find().toArray();
        }
    },
    Mutation: {
        deleteContact: async (_: unknown, args: DeleteContactMutationArgs, ctx: Context): Promise<boolean> => {
            const { deletedCount } = await ctx.ContactCollection.deleteOne({ _id: new ObjectId(args.id) });
            return deletedCount === 1;
        },
        addContacts: async (_: unknown, args: AddContactMutationArgs, ctx: Context): Promise<ContactModel> => {
            const API_KEY = Deno.env.get("API_KEY");
            if (!API_KEY) throw new GraphQLError("falta api kay");

            const { name, phone, contacts = [] } = args;

            const phoneExists = await ctx.ContactCollection.countDocuments({ phone });
            if (phoneExists >= 1) throw new GraphQLError("telefono existe");

            const url = `https://api.api-ninjas.com/v1/validatephone?number=${phone}`;
            const data = await fetch(url, { headers: { "X-Api-Key": API_KEY } });

            if (data.status !== 200) throw new GraphQLError("eurl error");

            const response: APIPhone = await data.json();
            if (!response.is_valid) throw new GraphQLError("Etelefono no valido");

            const country = response.country;
            const timezone = response.timezones[0];

            const contactExists = await ctx.ContactCollection.find({ _id: { $in: contacts.map((c) => new ObjectId(c)) } }).toArray();
            if (contactExists.length !== contacts.length) throw new GraphQLError("no todos existen");

            const { insertedId } = await ctx.ContactCollection.insertOne({
                name,
                phone,
                country,
                timezone,
                contacts: contacts.map((c) => new ObjectId(c))
            });

            return {
                _id: insertedId,
                name,
                phone,
                country,
                timezone,
                contacts: contacts.map((c) => new ObjectId(c))
            };
        },
        updateContact: async (_: unknown, args: UpdateContactMutationArgs, ctx: Context): Promise<ContactModel> => {
            const API_KEY = Deno.env.get("API_KEY");
            if (!API_KEY) throw new GraphQLError("You need the Api Ninja API_KEY");
      
            const { id, phone, name } = args;
            if (!phone && !name) {
              throw new GraphQLError("You must at least update one value");
            }
      
            if (!phone) {
              const newUser = await ctx.ContactCollection.findOneAndUpdate({
                _id: new ObjectId(id)
              }, {
                $set: { name }
              });
              if (!newUser) throw new GraphQLError("User not found!");
              return newUser;
            }
      
            const phoneExists = await ctx.ContactCollection.findOne({ phone });
            if (phoneExists && phoneExists._id.toString() !== id) throw new GraphQLError("Phone already taken by Diego");
      
            if (phoneExists) {
              const newUser = await ctx.ContactCollection.findOneAndUpdate({
                _id: new ObjectId(id)
              }, {
                $set: { name: name || phoneExists.name }
              });
              if (!newUser) throw new GraphQLError("User not found!");
              return newUser;
            }
            // phone has changed
            const url = `https://api.api-ninjas.com/v1/validatephone?number=${phone}`;
            const data = await fetch(url,
              {
                headers: {
                  "X-Api-Key": API_KEY
                }
              }
            );
            if (data.status !== 200) throw new GraphQLError("API Ninja Error");
      
            const response: APIPhone = await data.json();
      
            if (!response.is_valid) throw new GraphQLError("Not valid phone format")
      
            const country = response.country;
            const timezone = response.timezones[0];
      
            const newUser = await ctx.ContactCollection.findOneAndUpdate({
              _id: new ObjectId(id)
            }, {
              name,
              phone,
              country,
              timezone,
            })
            if (!newUser) throw new GraphQLError("User not found!");
            return newUser;
          },
    },
    Contact: {
        id: (parent: ContactModel): string => parent._id!.toString(),
        time: async (parent: ContactModel) : Promise<string> => {
            const API_KEY = Deno.env.get("API_KEY");
            if (!API_KEY) throw new GraphQLError("API_KEY no está definida en las variables de entorno.");
        
            const timezone = parent.timezone;
        
            const url = `https://api.api-ninjas.com/v1/worldtime?timezone=${timezone}`;
            
            const data = await fetch(url, {
                headers: { "X-Api-Key": API_KEY }
            });
        
            if (data.status !== 200) throw new GraphQLError("Error en la respuesta de la API");
        
            const response: APITime = await data.json();
            return response.datetime; 
        }
        ,
        contacts: async (parent: ContactModel, _: unknown, ctx: Context) => {
            const ids = parent.contacts;
            return await ctx.ContactCollection.find({ _id: { $in: ids } }).toArray();
        }
    }
};
