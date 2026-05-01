
import { supabase } from "../config/supabase.ts";
export const sendOtp = async (phone: string) => {
    if(!phone){
        throw new Error("Phone number is required");
    }
    if (!phone.startsWith("+")) {
    throw new Error("Phone must include country code. Example: +919999999999");
  }
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.message);
    return { message: "OTP sent successfully" };
}

export const verifyOtp = async (phone: string, otp: string) => {
    if(!phone || !otp){
        throw new Error("Phone number and OTP are required");
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