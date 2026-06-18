import Hero from '../components/landing/Hero'
import ShowcaseSection from '../components/landing/ShowcaseSection'

export default function Home() {
  return (
    <div className="flex flex-col items-center pb-32">
      <Hero />
      <ShowcaseSection />
    </div>
  )
}
