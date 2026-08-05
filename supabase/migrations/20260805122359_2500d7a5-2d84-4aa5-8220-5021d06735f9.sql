
CREATE TABLE public.scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  scenario_type text NOT NULL DEFAULT 'quick',
  duration_label text NOT NULL DEFAULT '5-15 minutes',
  setting text,
  premise text,
  tone text,
  best_for text[] NOT NULL DEFAULT '{}',
  instructions text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scenarios TO authenticated;
GRANT ALL ON public.scenarios TO service_role;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read scenarios" ON public.scenarios FOR SELECT TO authenticated USING (true);

CREATE TABLE public.scenario_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  recap text,
  day_started integer NOT NULL DEFAULT 1,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_sessions TO authenticated;
GRANT ALL ON public.scenario_sessions TO service_role;
ALTER TABLE public.scenario_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scenario sessions" ON public.scenario_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX scenario_sessions_user_idx ON public.scenario_sessions (user_id, last_active_at DESC);
CREATE TRIGGER scenario_sessions_set_updated_at BEFORE UPDATE ON public.scenario_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.story_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  scenario_session_id uuid REFERENCES public.scenario_sessions(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'moment',
  title text NOT NULL,
  description text,
  caption text,
  image_url text,
  day integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_events TO authenticated;
GRANT ALL ON public.story_events TO service_role;
ALTER TABLE public.story_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own story events" ON public.story_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX story_events_user_idx ON public.story_events (user_id, created_at DESC);
CREATE TRIGGER story_events_set_updated_at BEFORE UPDATE ON public.story_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS scenario_session_id uuid REFERENCES public.scenario_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_scenario_idx ON public.messages (scenario_session_id, created_at);

ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS daily_events_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS surprises_enabled boolean NOT NULL DEFAULT true;

INSERT INTO public.scenarios (slug, title, description, category, scenario_type, duration_label, setting, premise, tone, best_for, instructions, sort_order) VALUES
('first-date','Our First Date','The evening you both pretended not to be nervous about.','romance','episode','20-40 minutes','A small restaurant, then a walk','It is your first proper date together.','warm, nervous, tender','{Romantic Partner,Crush}','Play the whole evening: arriving, ordering, the lull, the walk after. Let small awkwardness happen.',10),
('rainy-day','Rainy Day Together','A storm rolls through the city and neither of you feels like leaving.','romance','quick','10-20 minutes','Indoors while rain hits the windows','You are stuck inside together for the afternoon.','cozy, unhurried','{Friend,Romantic Partner}','Keep it slow and atmospheric. Tea, blankets, the sound of rain.',20),
('late-night-walk','Late Night Walk','Empty streets, warm air, nothing to do but keep walking.','romance','quick','10-15 minutes','City streets after midnight','Neither of you can sleep, so you walk.','quiet, honest','{Friend,Romantic Partner}','Late night lowers everyone''s guard. Let the conversation drift somewhere real.',30),
('confession-stars','Confession Under the Stars','Something has been unsaid for a while.','romance','episode','20-40 minutes','A hillside away from the city lights','One of you finally says the thing.','vulnerable, charged','{Romantic Partner,Crush}','Build to it slowly. Do not rush the confession — let it be earned.',40),
('surprise-date','A Surprise Date','You planned something and refused to say what.','romance','episode','20-40 minutes','Wherever you are taking them','You surprise them with an evening they did not expect.','playful, excited','{Romantic Partner}','Let them guess and be wrong. Reveal it gradually.',50),
('weekend-getaway','Weekend Getaway','Two days, no plans, somewhere neither of you has been.','romance','arc','Multiple sessions','A small town away from home','You go away together for the weekend.','spacious, romantic','{Romantic Partner}','This unfolds across sessions: arriving, the first evening, the day after, going home.',60),
('watching-sunset','Watching the Sunset','The kind of quiet that does not need filling.','romance','quick','5-15 minutes','Somewhere with a view','You watch the sun go down together.','calm, intimate','{Friend,Romantic Partner}','Short and atmospheric. Silence is allowed.',70),
('cooking-together','Cooking Together','Ambitious recipe. Questionable execution.','slice-of-life','quick','10-20 minutes','A small kitchen','You attempt to cook something together.','light, funny','{Friend,Romantic Partner}','Let something go slightly wrong. Bicker about it affectionately.',80),
('movie-night','Movie Night','Neither of you can agree on what to watch.','slice-of-life','quick','10-20 minutes','A couch, too many blankets','Movie night, eventually.','relaxed, teasing','{Friend,Romantic Partner}','Half the fun is the argument about what to watch.',90),
('shopping-trip','Shopping Trip','You were only going in for one thing.','slice-of-life','quick','10-20 minutes','A busy shopping street','An ordinary errand turns into an afternoon.','breezy','{Friend,Romantic Partner}','Small observations, opinions on things, gentle teasing.',100),
('beach-day','Beach Day','Salt, heat, and too much sun.','slice-of-life','episode','20-40 minutes','A beach on a hot day','You spend the day by the water.','bright, easy','{Friend,Romantic Partner}','Let the day have a shape: morning, afternoon heat, evening cool.',110),
('road-trip','The Road Trip','Long hours, bad snacks, the best conversations.','slice-of-life','arc','Multiple sessions','A car, a highway, no fixed destination','You take a trip with no real plan.','wandering, warm','{Friend,Romantic Partner}','Unfolds across sessions. Each leg of the drive is its own chapter.',120),
('studying-together','Studying Together','Focus lasted about eleven minutes.','slice-of-life','quick','10-15 minutes','A library or quiet cafe','You try to be productive together.','low-key, distracted','{Friend,Mentor}','Productivity keeps failing. That is the point.',130),
('festival-day','Festival Day','Lanterns, food stalls, far too many people.','slice-of-life','episode','20-40 minutes','A crowded summer festival','You go to a festival together.','vivid, joyful','{Friend,Romantic Partner}','Use sensory detail — noise, food, lights. Try not to lose each other in the crowd.',140),
('exploring-city','Exploring the City','No map, no plan, just turns.','slice-of-life','quick','10-20 minutes','Unfamiliar streets','You wander a part of the city neither of you knows.','curious','{Friend,Romantic Partner}','Discover small things together.',150),
('coffee-together','Coffee Together','Twenty minutes, one table, no agenda.','slice-of-life','quick','5-15 minutes','A quiet cafe','A short, ordinary coffee.','simple, warm','{Friend,Romantic Partner,Mentor}','Small and grounded. No big events.',160),
('difficult-day','A Difficult Day','Today was heavy, and you do not want to explain why.','emotional','quick','10-20 minutes','Wherever you are','One of you had a hard day.','gentle, steady','{Friend,Romantic Partner}','Do not fix it. Just be present. No therapy-speak.',170),
('honest-conversation','An Honest Conversation','No deflecting this time.','emotional','episode','20-40 minutes','Somewhere private','You talk about something you have both been avoiding.','raw, careful','{Friend,Romantic Partner}','Let it be uncomfortable before it gets better.',180),
('talking-future','Talking About the Future','What happens after all this?','emotional','episode','20-40 minutes','Late evening, somewhere quiet','You talk about where this is going.','hopeful, uncertain','{Friend,Romantic Partner}','Both of you have hopes and hesitations. Voice them.',190),
('a-secret','The Secret','There is something they have not told you.','emotional','arc','Multiple sessions','Ordinary life with something underneath','Something has been held back.','tense, tender','{Friend,Romantic Partner}','Reveal slowly across sessions. Do not dump it in the first message.',200),
('making-up','Making Up','The argument is over. The awkwardness is not.','emotional','quick','10-20 minutes','After the fight','You find your way back to each other.','careful, warm','{Friend,Romantic Partner}','Apologies should feel earned, not automatic.',210),
('unexpected-visit','An Unexpected Visit','They showed up. No warning.','emotional','quick','5-15 minutes','Your doorstep','They turn up unannounced.','surprising, warm','{Friend,Romantic Partner}','Open in the middle of the moment — they are already there.',220),
('late-night-conversation','Late Night Conversation','It is far too late and neither of you is sleeping.','emotional','quick','5-15 minutes','Messages at 2am','A conversation that only happens this late.','soft, unguarded','{Friend,Romantic Partner}','Short messages. Long pauses implied. Honesty comes easier now.',230),
('mystery-investigation','The Mystery We Found','Something does not add up.','mystery','episode','20-60 minutes','A town with a loose thread','You investigate something strange together.','curious, suspenseful','{Friend,Rival,Romantic Partner}','Give clues. Let the user theorise. React to their ideas.',240),
('haunted-house','The Haunted House','It was supposed to be a dare.','mystery','episode','20-40 minutes','An abandoned house at night','You go somewhere you should not have.','eerie, funny-scared','{Friend,Romantic Partner}','Balance genuine atmosphere with humour and nerves.',250),
('treasure-hunt','Treasure Hunt','An old map and far too much confidence.','adventure','episode','20-40 minutes','Somewhere with a buried story','You follow a trail to something hidden.','playful, adventurous','{Friend,Rival,Romantic Partner}','Obstacles, wrong turns, a real find at the end.',260),
('fantasy-quest','Fantasy Quest','Two travellers, one road, several bad decisions.','fantasy','arc','Multiple sessions','A world of old roads and older magic','You travel together on a quest.','epic, characterful','{Friend,Rival,Romantic Partner}','Keep their real personality intact inside the fantasy role.',270),
('supernatural-encounter','Supernatural Encounter','Something in the treeline is watching.','fantasy','episode','20-40 minutes','The edge of a forest at dusk','You encounter something unexplainable.','tense, strange','{Friend,Romantic Partner}','Atmosphere over action. Restraint makes it scarier.',280),
('space-adventure','Space Adventure','A small ship, a long way from anywhere.','scifi','arc','Multiple sessions','A cramped ship between stars','You are crew on the same vessel.','vast, close-quarters','{Friend,Rival,Romantic Partner}','The isolation makes the relationship the real story.',290),
('valentines','Valentine''s Day','Neither of you was going to make a big deal of it.','seasonal','episode','20-40 minutes','A specific evening in February','Valentine''s Day, handled your own way.','sweet, slightly embarrassed','{Romantic Partner,Crush}','Avoid cliche. Make it specific to who they are.',300),
('halloween','Halloween','Costumes, sugar, and a walk home in the dark.','seasonal','quick','10-20 minutes','Halloween night','You spend Halloween together.','playful, spooky','{Friend,Romantic Partner}','Costumes should reflect their personality.',310),
('christmas','Christmas','Lights, quiet, and the good kind of cold.','seasonal','episode','20-40 minutes','Christmas evening','You spend Christmas together.','warm, nostalgic','{Friend,Romantic Partner}','Small rituals matter more than the gifts.',320),
('new-years-eve','New Year''s Eve','Ten seconds left of the year.','seasonal','quick','10-20 minutes','A rooftop before midnight','You see the year out together.','reflective, hopeful','{Friend,Romantic Partner}','Reference the year you have actually shared.',330),
('birthday','Birthday Celebration','Someone insisted on making a fuss.','seasonal','quick','10-20 minutes','Wherever the celebration is','A birthday, celebrated together.','joyful','{Friend,Romantic Partner}','Make the gift or gesture personal to what you know about them.',340),
('winter-evening','Winter Evening','Cold outside, warm in here.','seasonal','quick','5-15 minutes','A window seat in winter','A quiet winter evening in.','still, cosy','{Friend,Romantic Partner}','Slow, sensory, unhurried.',350),
('summer-festival','Summer Festival','Heat, music, and staying out too late.','seasonal','episode','20-40 minutes','A summer street festival','A long summer evening out.','alive, hazy','{Friend,Romantic Partner}','Let the night stretch on longer than planned.',360);
