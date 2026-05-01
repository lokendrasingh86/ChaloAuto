import {prisma } from "../lib/prisma.js";

export const getUserByPhoneNumber = async (phone:string) => {
    if(!phone){
        throw new Error("Phone number is required");
    }
    const user = await prisma.user.findUnique({
        where: {
            phone,
        },
    });
    return user;
}


export const finduserById = async (id: string) => {
    if(!id){
        throw new Error("User ID is required");
    }
    const user = await prisma.user.findUnique({
        where: {
            id,
        },
    });
    return user;

}


export const createUser = async (
  id: string,
  phone: string
) => {

  if (!id || !phone) {
    throw new Error("ID and phone required");
  }

  return await prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      phone
    }
  });
};