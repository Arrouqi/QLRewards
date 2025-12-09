import { motion } from "framer-motion";
import { CheckCircle2, Home, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Success() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <Card className="max-w-md w-full border-none shadow-2xl bg-white overflow-hidden">
        <div className="h-2 bg-green-500" />
        <CardContent className="p-8 pt-12 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6"
          >
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </motion.div>
          
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-slate-900 mb-2"
          >
            Deal Submitted Successfully!
          </motion.h1>
          
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-slate-600 mb-8 leading-relaxed"
          >
            Thanks for submitting your deal. The Living Deals team will review your submission and contact you shortly.
          </motion.p>
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="w-full space-y-3"
          >
            <Link href="/">
              <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11">
                <Home className="mr-2 h-4 w-4" />
                Return to Home
              </Button>
            </Link>
            <Button variant="ghost" className="w-full text-slate-500 hover:text-slate-900 h-11">
              View Status
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
