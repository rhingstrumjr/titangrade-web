import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-emerald-100 italic-gradient-bg">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-lg shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="text-2xl font-black tracking-tight text-gray-900">TitanGrade</span>
        </div>
        <div className="flex gap-4">
          <Link
            href="/teacher"
            className="px-6 py-2.5 bg-gray-900 text-white font-bold rounded-full hover:bg-emerald-600 transition-all shadow-md hover:shadow-xl active:scale-95"
          >
            Teacher Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold tracking-wide uppercase">
            Built for NGSS & Marzano Standards
          </div>
          <h1 className="text-6xl lg:text-7xl font-black text-gray-900 leading-[1.1]">
            AI Grading that <span className="text-emerald-600">Actually</span> Understands.
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-xl">
            The first AI-powered science grading assistant zeroed in on visual evidence. Transcribes handwriting, checks multiple choice, and applies strict rubric logic without the hallucinations.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <Link
              href="/teacher"
              className="px-8 py-4 bg-emerald-600 text-white font-bold text-lg rounded-2xl hover:bg-emerald-700 transition-all shadow-xl hover:shadow-emerald-200 active:scale-95"
            >
              Start Grading Free
            </Link>
            <div className="px-8 py-4 bg-white border-2 border-gray-100 text-gray-400 font-bold text-lg rounded-2xl cursor-not-allowed">
              Watch Demo
            </div>
          </div>
          <div className="flex items-center gap-6 pt-8 text-sm font-medium text-gray-400">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              No Domain Required
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Vision Pro Verified
            </div>
          </div>
        </div>

        {/* Feature Grid Mockup */}
        <div className="relative animate-in fade-in zoom-in duration-1000">
          <div className="absolute -inset-4 bg-emerald-500/10 rounded-[3rem] blur-3xl"></div>
          <div className="relative bg-white border-8 border-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden aspect-[4/3] flex items-center justify-center">
            <div className="p-12 text-left space-y-6 w-full">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl"></div>
                  <div>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-20 bg-gray-100 rounded mt-2 animate-pulse"></div>
                  </div>
                </div>
                <div className="text-emerald-600 font-bold text-xl tracking-tight italic">Grading...</div>
              </div>
              <div className="space-y-4">
                <div className="h-3 w-full bg-gray-50 rounded"></div>
                <div className="h-3 w-full bg-gray-50 rounded"></div>
                <div className="h-3 w-4/5 bg-gray-50 rounded"></div>
              </div>
              <div className="p-6 bg-emerald-50 rounded-2xl border-2 border-emerald-100">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xs italic">AI</div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-3/4 bg-emerald-200 rounded"></div>
                    <div className="h-2 w-full bg-emerald-100 rounded"></div>
                    <div className="h-2 w-full bg-emerald-100 rounded"></div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-end pt-4">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Transcription</div>
                  <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    &quot;Question 1: Circled B&quot;
                  </div>
                </div>
                <div className="text-4xl font-black text-gray-900 tracking-tighter italic">3.5 / 4.0</div>
              </div>
            </div>
          </div>

          {/* Floating Element */}
          <div className="absolute -bottom-8 -left-8 bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 flex items-center gap-4 animate-bounce duration-[3000ms]">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Efficiency</div>
              <div className="text-sm font-black text-gray-900 leading-tight">Save 4+ Hours / Week</div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-400 font-medium">
        <div>© 2026 TitanGrade. Built for Teachers, by Teachers.</div>
        <div className="flex gap-8">
          <Link href="/privacy" className="hover:text-emerald-600 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-emerald-600 transition-colors">Terms</Link>
          <a href="#" className="hover:text-emerald-600 transition-colors">Twitter</a>
        </div>
      </footer>
    </div>
  );
}
