import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import api from '@/lib/api';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('PASSENGER');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const requestOtp = async () => {
    if (!phone) return toast({ title: "Error", description: "Enter phone number", variant: "destructive" });
    try {
      await api.post('/auth/request-otp', { phone, role });
      setOtpSent(true);
      toast({ title: "OTP Sent", description: "If you used seed data, use 123456 as the OTP." });
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to send OTP", variant: "destructive" });
    }
  };

  const verifyOtp = async () => {
    try {
      const res = await api.post('/auth/verify-otp', { phone, otp, role });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      toast({ title: "Success", description: "Logged in successfully!" });
      
      // The backend returns role as 'Passenger' or 'Driver'
      if (res.data.user.role === 'Passenger' || res.data.user.role === 'PASSENGER') {
        navigate('/passenger');
      } else {
        navigate('/driver');
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Invalid OTP", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">ChaloAuto Login</CardTitle>
          <CardDescription>Enter your phone number to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole} disabled={otpSent}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASSENGER">Passenger</SelectItem>
                <SelectItem value="DRIVER">Driver</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input 
              placeholder="e.g. +919876543210" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)}
              disabled={otpSent}
            />
          </div>

          {otpSent && (
            <div className="space-y-2">
              <Label>OTP (Demo defaults to 123456)</Label>
              <Input 
                placeholder="123456" 
                value={otp} 
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
          )}

          <Button className="w-full" onClick={otpSent ? verifyOtp : requestOtp}>
            {otpSent ? "Verify OTP" : "Send OTP"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}