
import { supabase } from "../config/supabase.ts";
import { prisma } from "../lib/prisma.ts";
import { signLocalToken, testLoginAllowed } from "../lib/tokens.ts";

const isTestNumber = (phone: string) =>
    testLoginAllowed() && (phone === "+919999999999" || phone.includes("99990000") || phone.includes("88880000"));

export const sendOtp = async (phone: string) => {
    if(!phone){
        throw new Error("Phone number is required");
    }
    if (!phone.startsWith("+")) {
    throw new Error("Phone must include country code. Example: +919999999999");
  }

  if (isTestNumber(phone)) {
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

  if (isTestNumber(phone) && otp === "123456") {
       // Reuse the seeded user (if any) so ids stay stable between logins
       const cleanPhone = phone.startsWith("+91") ? phone.slice(3) : phone;
       const existingUser = await prisma.user
           .findFirst({ where: { phone: { endsWith: cleanPhone } } })
           .catch((error: unknown) => {
               console.error("Prisma error during test OTP login", error);
               return null;
           });
       const userId = existingUser?.id ?? `test-user-${cleanPhone}`;

       return {
         user: { id: userId, phone: existingUser?.phone ?? phone },
         accessToken: signLocalToken(userId),
         refreshToken: ""
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