
import { supabase } from "../config/supabase.js";
import { prisma } from "../lib/prisma.js";

export const sendOtp = async (phone: string) => {
    if(!phone){
        throw new Error("Phone number is required");
    }
    if (!phone.startsWith("+")) {
    throw new Error("Phone must include country code. Example: +919999999999");
  }

  if (phone === "+919999999999" || phone.includes("99990000") || phone.includes("88880000")) {
       return { message: "OTP sent successfully (Test Number Bypass)" };
  }

    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.message);
    return { message: "OTP sent successfully" };
}

export const verifyOtp = async (phone: string, otp: string) => {
    if(!phone || !otp){
        throw new Error("Phone number and OTP are required");
    }

  if ((phone === "+919999999999" || phone.includes("99990000") || phone.includes("88880000")) && otp === "123456") {
       // Check if this test user already exists in our db to reuse its ID
       const cleanPhone = phone.startsWith("+91") ? phone.slice(3) : phone;
       let existingUser = null;
       try {
           existingUser = await prisma.user.findFirst({
               where: { phone: { endsWith: cleanPhone } }
           });
       } catch (error) {
           console.error("Prisma Error during test OTP bypass. Returning mock user.", error);
       }
       
       return {
         user: { id: existingUser?.id || `test-user-${Date.now()}`, phone },
         accessToken: "fake-test-jwt-token-abcd",
         refreshToken: "fake-test-refresh-token-abcd"
       };
  }

    const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: "sms",
  });
    if (error || !data.session) {
    throw new Error("Invalid OTP");
  }

  return {
    user: data.user,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token
  };
}