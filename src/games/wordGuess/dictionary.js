// Word Guess dictionary.
//
// ANSWER words are hand-curated in three familiarity bands. Every answer is an ordinary English word a
// typical adult player knows: no proper nouns, abbreviations, slurs, crude words, plurals ending in a lone "s",
// or spellings that only exist in one country (so "color", "honor", "fiber" are guesses, never answers).
//   1 = everyday words a child knows
//   2 = familiar words most adults use
//   3 = less common but fair words (the hardest the game ever gets)
// The level generator (levels.js) combines familiarity with letter rarity, repeated letters and ambiguity
// to rank them. EXTRA_GUESSES are further real words accepted as guesses but never chosen as answers.
// Tests check that every list is well formed and that every answer can be found within six guesses.

const words = s => s.trim().split(/\s+/)

export const COMMON = words(`
about above after again agree ahead alarm alive allow alone along angry apple apply award aware
bacon badge baker basic beach begin below bench berry birth black blank blind block blood board
brain brave bread break brick bride brief bring broad brown brush build bunch candy carry catch
cause chain chair chalk charm chart cheap check cheek cheer chest chick chief child chill clean
clear climb clock close cloth cloud clown coach coast couch count cover crack craft crash crazy
cream crowd crown dance dirty doubt dozen draft drama dream dress drink drive early earth eight
elbow empty enemy enjoy enter equal error event every exact extra faith false fancy fault feast
fence field fifty fight final first flame flash float floor flour focus force forty frame fresh
front frost fruit funny ghost giant glass globe glove grade grain grand grape grass great green
group guard guess guest guide happy heart heavy hello honey horse hotel house human hurry image
juice judge knife label large laugh layer learn least leave lemon level light lucky lunch magic
major march match maybe metal money month motor mouse mouth movie music never night noise north
nurse ocean offer often onion order other owner paint panel paper party pasta peace pearl phone
photo piano pilot pizza place plain plane plant plate point power press price pride print prize
proud queen quick quiet quite radio raise reach ready relax right river robot round royal salad
sauce scale scare scarf scene score seven shade shake shape share shark sharp sheep sheet shelf
shell shine shirt shoot short shout sight skill skirt sleep slice slide small smart smell smile
smoke snack snake sound south space speak speed spend spice spoon sport stage stair stamp stand
start steak steam stick still stone store storm story stove straw study style sugar sunny super
sweet swing table taste teach teeth thank thick thing think three throw thumb tiger tired title
toast today tooth topic total touch towel tower track trade train treat trick truck trust truth
uncle under until upset usual value video visit voice waste watch water wheel where white whole
woman world worry write wrong young youth zebra
`)

export const FAMILIAR = words(`
actor adapt admit adopt adult agent alert alien alley amuse angel ankle apart arena argue arise
arrow aside asset avoid awake basin batch beard beast bingo blade blame blend bless bloom blush
boast bonus boost booth bound brand brass breed broom buddy burst cabin cable camel canal cargo
carve chase cheat chord choir civil claim clash class clerk click cliff cloak coral cough crane
crawl creek crisp crumb crust curve cycle daily dairy daisy debut decay delay dense depth diary
dodge donor drain drift drill eagle elder elect elite entry essay exist fable fairy flock flood
fluid flute foggy forge found frown glide gloom glory grace grasp gravy greed grief grill grove
habit harsh haste hatch haunt hedge hobby ideal index inner input irony issue ivory jelly jewel
joint joker jolly knock laser ledge legal lever linen liver lodge loyal lyric manor maple
marsh medal mercy merit merry minor mixer moist moral mound muddy naval nerve noble novel oasis
olive opera orbit organ otter outer panic pedal penny perch petal phase pitch pivot plaza
plume poker polar porch pouch pound prank prism probe proof prose punch pupil purse quart quest
quilt quota quote radar rally ranch range rapid raven razor realm rebel relay reply rhyme rider
ridge rigid rival roast robin rocky rough route rural saint scent scoop scout scrap screw sense
serve shave shift shock shore shrug silly skate skull slate slope snail sneak solar solid solve
spare spark spear spell spike spine spray squad stack staff stain stake steel steep steer stiff
sting stool strip stuck stuff surge swamp swarm swear sweat sweep swift sword syrup tempo thief
thorn tidal tight token torch toxic trail trait trend trial tribe troop tulip tutor twist unity
upper urban vault verse vivid vocal wagon waist weary weave wedge witch wound woven wrist yacht
yearn yield
`)

export const FAIR = words(`
abbey abide adore agile alibi aloft aloof amber amble ample angst anvil aroma askew attic audit
avert axiom azure banjo baron basil bayou bison blaze bliss bluff blurt boxer braid brawl brine
brisk brood brook broth bugle bulky burly cadet caper cello chant chasm chime chirp cider cinch
civic clamp cleft clump cocoa comet conch covet crept croak crypt cumin dandy decal decoy delta
depot digit ditch diver drawl droop dusky dwell eerie elope elude ember enact envoy epoch
equip erode evict exalt expel facet feign femur ferry fetch fiery flair flank fleck flint
flora foyer frail friar frond froth fudge fungi gaudy gauge gavel gecko gleam glean gnome gouge
gourd guild guise gusto haiku hasty haven heron hinge hippo hoist husky hutch hyena igloo inept
inlet irate jaunt joust kayak knack knead kneel lapel lasso leash lemur lilac llama lofty lunar
lurch macaw mango mauve mirth molar mogul morph motto mural nifty niche nomad notch nudge nylon
onset optic ounce parka pecan perky pesky pinch pixel plank pluck plumb poach prowl pulse quail
qualm quell quirk recap regal relic rerun revel rhino risky rivet roost rouge rowdy ruddy rusty
sable salsa salve savvy scald scalp scorn scour scowl sedan shard shawl shear shrew shrub siren
skiff slant sleek sleet slosh sloth slump smirk snare snarl sneer snore snout sonar spawn spurn
squat squid stash stoic stomp stork stout strut suave swoop taboo tacit talon tango taper tapir
tardy tawny tenet tepid terse thyme tiara tonic topaz tunic twang unfit unzip usher utter valet
viper visor vista vogue waltz wharf whiff whirl wield wrath wreck wring yodel
`)

export const EXTRA_GUESSES = words(`
aback abase abate abbot abhor abode abort abuse abyss acorn acrid acres acted acute adage added
adder addle adept admin aegis afire afoot afoul agape agate agave aging agony aided aides aimed
aired aisle alder algae alias align alike allay allot alloy aloha aloud alpha altar alter amass
amaze amend amiss amity among angle anime anise annex annoy annul anode antic antsy aorta apace
aphid apnea apron aptly arced ardor areas argon arias armed armor arose array arson artsy ascot
ashen ashes asked aspen assay atlas atoll atoms atone audio auger aunts aural autos avail avian
await awash awful awoke axial axles
babes backs badly bagel baggy bails baits baked bakes balls balmy balsa banal bands bangs banks
barbs bards bared barge barks barns basal based bases basis baste bathe baths baton batty bawdy
beads beady beaks beams beans bears beats beefy beeps beers beets befit began beget begun beige
being belch belie belle bells belly belts bends beret berth beset bible bicep bides bikes biker
bilge bills binds binge biome birch birds bites bitty bland blare blast bleak bleat bleed bleep
blimp blink blips blitz bloat blobs blocs bloke blond blots blown blows bluer blues blunt blurb
blurs boars boats bobby bodes bogey boggy boils bolts bombs bonds boned bones bongo books booms
boots booty booze borax bored borer bores borne bosom bossy botch bough bouts bowed bowel bowls
boxed boxes brace brags brake brash brats bravo brawn brays brews briar bribe brink briny broil
broke brows brunt brute buggy bulbs bulge bulls bully bumps bumpy bunks bunny buoys burns burnt
burps busts butte butts buyer buzzy bylaw built
caddy cafes caged cages cagey cairn caked cakes calls calms camps canny canoe canon caped capes
cards cared cares carol carps carts cased cases casks caste casts cater catty caulk cease cedar
ceded chafe chaff chaos chaps chard chars chats cheep chefs chews chewy chide chili chimp china
chins chips chive chock choke chomp chops chore chose chuck chugs chump chunk churn chute cigar
circa cited cites clack clams clang clank clans claps clasp claws clays cleat clink clips clods
clogs clone clots clout clove clubs cluck clued clues clung coals coats cobra cocky codes coils
coins colas colds colon combo comas combs comes comfy comic comma cones cooks cools coops copes
copse cords cored cores corgi corny corps costs could coupe coups court covey cower coyly crabs
crags cramp crams crank crass crate crave craze creak credo creed creep crepe cress crest cribs
cried crier cries crime crimp crock crone crony crook croon crops crude cruel crush cubes cubic
cuffs culls cults cured curls curly curry curse curvy cushy cuter cyber cynic color
daddy dally dames damps dared dares darns darts dated dates datum daunt dawns dazed deals dealt
deans dears death debit debts debug decaf decks decor decry deeds deems defer deign deity delve
demon demos denim dents deter detox deuce devil diced dices dicey diets dimly dined diner dines
dingo dingy dinky diode dirge disco discs disks ditsy ditty divan divas dived dives divot dizzy
docks dodgy doers doggy dogma doing dolls dolly domed domes donut dooms doors doped dopey dorky
dorms dosed doses doted dotty dough douse dowdy dowel downs downy dowry dozed dozes drags drank
drape drawn draws dread dregs dried drier dries drips droll drone drool drops dross drove drown
drugs drums dryer dryly ducks ducts dudes duels duets dukes dully dummy dumps dumpy dunes dunks
dusts dusty duvet dwelt dying
eager eared earls earns eased easel eases eaten eater eaves ebbed ebony edged edges edict edify
egged egret eject eking elate elfin elide elves email embed emery emits emote ended endow ennui
ensue epoxy erase erect erred erupt ether ethic ethos evade evens evils evoke exams excel exert
exile exits extol exude exult
faced faces facts faded fades fails faint fairs faked fakes falls famed fangs farce fared fares
farms fatal fated fatty fauna favor fawns faxed faxes fazed fears feeds feels feint fella fends
feral ferns fetal fetid fetus feuds fewer fiber fibre fiend fifth filch filed files filet fills
filly films filmy filth finch finds fined finer fines fired fires firms fishy fists fiver fixed
fixer fixes fizzy flags flail flaky flans flaps flare flask flats flaws fleas fleet flesh flick
flier flies fling flips flirt flits flogs floss flown flows flubs fluff fluke flung flunk flush
foams foamy focal foils folds folks folly fonts foods fools foray forgo forms forte forth forts
forum fouls foxes franc frank fraud frays freak freed freer frees fries frill frisk frizz frock
frogs froze fryer fuels fully fumed fumes funds funky furor furry fused fuses fussy fusty fuzzy
gabby gaffe gains gaits galas gales galls gamer games gamma gamut gangs gaped gapes gases gasps
gassy gated gates gator gaunt gauze gauzy gazed gazes gears geeky geese genes genie genre gents
germs getup ghoul giddy gifts gilds gills girls girly girth given giver gives gizmo glade gland
glare glaze glens glint gloat globs gloss glows glued glues glyph gnash gnats gnaws goals goats
godly going golds goner gongs goods goody gooey goofs goofy goose gored gorge gorse gowns grabs
grads graft grant graph grate grave graze greet grids grime grimy grind grins gripe grips grist
grits groan groin groom grope gross grout growl grown grows grubs gruff grunt guava guilt gulch
gulfs gulls gully gulps gumbo gummy guppy gusts gusty gutsy
hacks hails hairs hairy halls halts halve hands handy hangs hanky hardy harem harms harps harpy
hated hater hates hauls havoc hawks hazel heads heady heals heaps heard hears heath heats heave
heeds heels hefty heirs heist helix helms helps hence herbs herds hides highs hiked hiker hikes
hills hilly hilts hints hippy hired hires hitch hives hoard hoary holds holed holes holly homes
homey honed hones honks honor hoods hoofs hooks hoops hoots hoped hopes horde horns hosed hoses
hosts hours hovel hover howdy howls hubby huffs huffy hulks hulls humid humor humps humus hunch
hunks hunts hurls hurts husks hydra hymns hyper
icier icily icing icons ideas idiom idiot idled idler idles idols image imbue impel imply inane
inbox incur indie inert infer ingot inked inlay inset intro irked irons isles islet itchy items
jacks jaded jails jambs jawed jazzy jeans jeeps jeers jerks jerky jests jetty jiffy jimmy jived
jives jocks joins joist joked jokes jolts jowls juicy jumbo jumps jumpy junks junky juror
karat karma kebab keels keeps keyed khaki kicks kiddo kills kilns kilos kilts kinda kinds kings
kinks kiosk kites kitty knave kneed knees knell knits knobs knoll knots known knows koala kudos
labor laced laces lacks laden ladle lager lairs lakes lambs lamps lance lands lanes lanky lapse
larks larva lasts later latex lathe latte lawns leads leafy leaks leaky leans leant leaps leapt
lease leech leeks leers lefty leggy lends levee liars libel licks liege lifts liked liken likes
limbo limbs limes limit limps lined liner lines lingo links lions lipid lists liter lithe lived
liven lives livid loads loafs loamy loans loath lobby lobes local locks lofts logic logos loins
loner longs looks looms loony loops loopy loose loots loped lords lorry loser loses lotto lotus
louse lousy loved lover loves lower lowly lucid lucks lulls lumps lumpy lunge lured lures lurid
lurks lusty lying lymph
macho macro madam madly mafia magma maids mails maims mains maize males malls malts mange mangy
mania manly manna marks marry masks mason masts mated mates maths matte mauls maxim mayor mazes
meals mealy means meant meaty medic meets melee melon melts memes memos mends menus meows merge
messy metro micro midst might milks milky mills mimed mimes mimic mince minds mined miner mines
minty minus mired mires miser misty miter mites mitts mixed mixes moans moats mocha mocks modal
modem molds moldy moles mommy monks moods moody moons moose moped mopes mossy motel moths motif
mould mount mourn mousy moved mover moves mower mucky mucus muffs mulch mules mummy munch murky
mused muses mushy musky musty muted mutes mutts myths
nacho nails naive naked named names nanny nappy nasal nasty natal natty navel needs needy neigh
nerdy nests newer newly nicer nicks niece ninja ninth nippy nobly nodal nodes noisy nooks noose
norms nosed noses nosey noted notes nouns nutty nymph
oaken oaths obese obeys oboes occur octal octet odder oddly odors offal ogres oiled oinks okays
olden older oldie omega omens omits oomph oozed oozes opals opens opine opium opted orcas ought
ousts outdo outed outgo ovals ovary ovens overt owing owlet owned oxide ozone
paced paces packs pacts paddy padre pagan paged pager pages pails pains pairs paled paler pales
palms palsy panda panes pangs pansy pants papal papas parch pared pares parks parry parse parts
paste pasty paths patio patsy patty pause paved paves pawed pawns payee payer peach peaks peals
pears pecks peeks peels peeps peers penal pence penne peony peril perks perms pesos pests petty
phony picks picky piece piers piety piggy piled piles pills pined pines pings pinky pints pious
piped piper pipes pique pithy pixie plaid plait plans plats plays plead pleas pleat plied plies
plods plops plots plows ploys plugs plump plums plunk plush pocks poems poets poise poked pokes
poled poles polka polls polyp ponds pools poppy pored pores ports posed poser poses posit posse
posts potty pours pouts prams prawn prays preen preys prick pricy pried pries prime primp prior
privy prods prone prong props prove prows proxy prude prune pudgy puffs puffy pulls pulps pulpy
pumas pumps punks punts puppy puree purer purge purls purrs pushy putty pygmy
quack quads quaff quake quark quash quasi query queue quill quits quoth
rabbi rabid raced racer races racks radii radon rafts raged rages raids rails rains rainy raked
rakes ramen ramps rangy ranks rants rarer rasps raspy rated rates ratio ratty raved ravel raves
rayon razed react reads reams reaps rearm rears rebar rebus rebut recur redid reeds reedy reefs
reeks reels refer refit rehab reign reins remit remix renal renew rents repay repel reset resin
rests retch retro retry reuse revue rides rifle rifts rigor rinds rings rinks rinse riots ripen
riper risen riser rises risks rites ritzy roach roads roams roars robed robes rocks rodeo rogue
roles rolls romps roofs rooks rooms roomy roots roped ropes roses rosin rotor rouse routs roved
rover rowed rower rubes ruble ruder ruffs rugby ruins ruled ruler rules rumba rummy rumor rumps
runes rungs runny runts rupee rusts
sacks sadly safer safes sagas sages saggy sails sakes sales sally salon salts salty salvo samba
sands sandy saner sappy sassy satin satyr saucy sauna saute saved saver saves savor sawed scabs
scaly scamp scams scans scant scars scary scion scoff scold scone scoot scope scram scree scrub
scuba scuff seals seams sears seats sects sedge seeds seedy seeks seems seeps seers seize sells
sends sepia serfs serum setup sever sewed sewer shack shady shaft shaky shale shall shame shank
sheds sheen sheer sheik shied shies shims shins shiny ships shire shirk shoal shoes shone shook
shoos shops shorn shots shove shown shows showy shred shuck shuns shunt shush shuts shyly sided
sides siege sieve sifts sighs sigma signs silks silky sills since sinew singe sings sinks sinus
sired sires sissy sitar sited sites sixes sixth sixty sized sizes skein skews skids skied skier
skies skimp skims skins skips skits skulk skunk slabs slack slain slams slang slaps slash slats
slave slays sleds slept slick slime slimy sling slink slips slits slobs slogs slops slots slows
slugs slums slung slunk slurp slurs slush slyly smack smash smear smelt smite smith smock smoky
snags snaky snaps sniff snipe snips snobs snoop snort snowy snubs snuck snuff soaks soaps soapy
soars sober socks sodas sofas softy soggy soils soles solos songs sonic sooty soppy sorry sorts
souls soups soupy sours sowed sower spade spank spans spars spasm spate spats speck specs spelt
spent spews spicy spied spiel spies spiky spill spilt spiny spire spite spits splat split spoil
spoke spoof spook spool spore spots spout spree sprig spunk spurs spurt squib stabs stags staid
stale stalk stall stank stare stark stars state stats stave stays stead steal steed stems steps
stern stews stilt stink stint stirs stock stoke stole stony stood stoop stops stows strap stray
strep strew strum stubs studs stump stung stunk stuns stunt sucks sudsy suede suing suite suits
sulks sulky sully sumac surer surfs surly sushi swabs swami swans swaps swash swath swats sways
swell swept swigs swill swims swine swipe swirl swish swore sworn swung synod
tabby tacks tacky tacos taffy tails taint taken taker takes tales talks tally tamed tamer tames
tangy tanks taped tapes tarot tarps tarry tarts tasks tasty tatty taunt taupe taxed taxes taxis
teams tears teary tease teddy teems teens teeny tells tempt tends tenor tense tenth tents tepee
terms tests testy texts thaws theft their theme there these thigh thine thins third thong those
threw throb thuds thugs thump ticks tided tides tiers tilde tiled tiles tills tilts timed timer
times timid tinge tints tipsy tires titan tithe toads toddy togas toils tolls tombs tomes tonal
toned toner tones tongs tools torso torts totem totes tough tours touts towed towns toxin toyed
trace tract tramp trams traps trash trawl trays tread trees treks tress triad tried tries trike
trill trims trios tripe trips trite troll trope trots trout truce truer truly trump trunk truss
tubas tubby tubed tubes tucks tufts tummy tumor tuned tuner tunes turbo turfs turns tusks tweak
tweed tweet twerp twice twigs twine twins twirl tying typed types typos
udder ulcer ultra umbra uncut undid undue unfed unify union unite units unlit untie unwed upend
upped urged urges usage users using usurp
vague vales valid valor valve vamps vanes vapor vases vaunt veers vegan veils veins venal vends
venom vents venue verbs verge vests vials vibes vicar vices views vigil vigor viler villa vines
vinyl viola viral virus visas vital vixen vodka voids volts vomit voted voter votes vouch vowed
vowel vying
wacky waded wader wades wafer waged wager wages waifs wails waits waive waked waken wakes walks
walls wands waned wanes wants wards wares warms warns warps warts warty washy wasps watts waved
waver waves waxed waxen waxes weeds weedy weeks weeps weepy weigh weird welds wells welts wends
whack whale wheat whelp which while whims whine whiny whips whisk whoop whose wicks widen wider
widow width wilds wills wimpy wince winch winds windy wines wings winks wiped wiper wipes wired
wires wiser wisps wispy witty wives woken women woods woody wooed woofs wools words wordy works
worms wormy worse worst worth would wraps wreak wrens wrest writs wrote wrung wryly
xenon yanks yards yarns yawns years yeast yells yelps yogis yokel yokes yours yowls yucca yucky
yummy zappy zeros zesty zilch zingy zippy zonal zoned zones zooms
cells desks forks miles makes wears
latch patch tapir fjord elegy
`)
